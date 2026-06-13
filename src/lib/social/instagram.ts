/**
 * Integração Instagram via Meta Graph API (Fase 4 — métricas).
 * Grátis. Para a conta do próprio usuário (dono do app Meta), não precisa
 * de App Review — funciona em modo de desenvolvimento.
 *
 * Requer: META_APP_ID, META_APP_SECRET (variáveis de ambiente).
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

export const IG_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

/** URL do diálogo de login/autorização da Meta. */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: redirectUri,
    scope: IG_SCOPES,
    response_type: "code",
    state,
  });
  return `${OAUTH_DIALOG}?${params}`;
}

async function gget<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${GRAPH}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Graph API ${res.status}`);
  }
  return data as T;
}

/** Troca o code por token de curta duração. */
async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const data = await gget<{ access_token: string }>("/oauth/access_token", {
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: redirectUri,
    code,
  });
  return data.access_token;
}

/** Converte token de curta em longa duração (~60 dias). */
async function getLongLivedToken(shortToken: string): Promise<{ token: string; expiresIn: number }> {
  const data = await gget<{ access_token: string; expires_in: number }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    fb_exchange_token: shortToken,
  });
  return { token: data.access_token, expiresIn: data.expires_in ?? 5184000 };
}

interface IgAccount {
  igUserId: string;
  username: string;
  followersCount: number;
  mediaCount: number;
  profilePicture: string | null;
  pageId: string;
  token: string;
  expiresAt: string;
}

/**
 * Fluxo completo: code → token longo → encontra a conta IG Business
 * ligada a uma página do Facebook → retorna dados + token.
 */
export async function connectInstagram(code: string, redirectUri: string): Promise<IgAccount> {
  const shortToken = await exchangeCode(code, redirectUri);
  const { token, expiresIn } = await getLongLivedToken(shortToken);

  // Páginas do Facebook do usuário
  const pages = await gget<{ data: { id: string; access_token: string }[] }>("/me/accounts", {
    access_token: token,
  });
  if (!pages.data?.length) {
    throw new Error("Nenhuma página do Facebook encontrada. Conecte sua conta do Instagram a uma página.");
  }

  // Acha a página que tem conta IG Business
  let igUserId = "";
  let pageId = "";
  for (const page of pages.data) {
    try {
      const r = await gget<{ instagram_business_account?: { id: string } }>(`/${page.id}`, {
        fields: "instagram_business_account",
        access_token: token,
      });
      if (r.instagram_business_account?.id) {
        igUserId = r.instagram_business_account.id;
        pageId = page.id;
        break;
      }
    } catch {
      // tenta a próxima página
    }
  }
  if (!igUserId) {
    throw new Error("Conta do Instagram comercial não encontrada. Verifique se seu Instagram é Profissional e está ligado a uma página do Facebook.");
  }

  // Dados da conta IG
  const acc = await gget<{
    username: string;
    followers_count: number;
    media_count: number;
    profile_picture_url?: string;
  }>(`/${igUserId}`, {
    fields: "username,followers_count,media_count,profile_picture_url",
    access_token: token,
  });

  return {
    igUserId,
    username: acc.username,
    followersCount: acc.followers_count ?? 0,
    mediaCount: acc.media_count ?? 0,
    profilePicture: acc.profile_picture_url ?? null,
    pageId,
    token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export interface IgPostMetric {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl: string | null;
  permalink: string;
  timestamp: string;
  likes: number;
  comments: number;
  reach: number;
  saved: number;
}

export interface IgInsights {
  followersCount: number;
  mediaCount: number;
  username: string;
  profilePicture: string | null;
  posts: IgPostMetric[];
}

/** Busca métricas da conta + dos posts recentes. */
export async function fetchInsights(igUserId: string, token: string): Promise<IgInsights> {
  const acc = await gget<{
    username: string;
    followers_count: number;
    media_count: number;
    profile_picture_url?: string;
  }>(`/${igUserId}`, {
    fields: "username,followers_count,media_count,profile_picture_url",
    access_token: token,
  });

  const media = await gget<{
    data: {
      id: string;
      caption?: string;
      media_type: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink: string;
      timestamp: string;
      like_count?: number;
      comments_count?: number;
    }[];
  }>(`/${igUserId}/media`, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: "12",
    access_token: token,
  });

  const posts: IgPostMetric[] = [];
  for (const m of media.data ?? []) {
    let reach = 0;
    let saved = 0;
    try {
      const ins = await gget<{ data: { name: string; values: { value: number }[] }[] }>(
        `/${m.id}/insights`,
        { metric: "reach,saved", access_token: token }
      );
      for (const metric of ins.data ?? []) {
        const v = metric.values?.[0]?.value ?? 0;
        if (metric.name === "reach") reach = v;
        if (metric.name === "saved") saved = v;
      }
    } catch {
      // insights podem não existir p/ alguns tipos de mídia
    }
    posts.push({
      id: m.id,
      caption: m.caption?.slice(0, 120) ?? "",
      mediaType: m.media_type,
      mediaUrl: m.thumbnail_url ?? m.media_url ?? null,
      permalink: m.permalink,
      timestamp: m.timestamp,
      likes: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
      reach,
      saved,
    });
  }

  return {
    followersCount: acc.followers_count ?? 0,
    mediaCount: acc.media_count ?? 0,
    username: acc.username,
    profilePicture: acc.profile_picture_url ?? null,
    posts,
  };
}
