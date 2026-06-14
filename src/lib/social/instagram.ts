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
  shares: number;
  views: number;
  totalInteractions: number;
}

export interface IgFollowerPoint {
  date: string; // ISO
  value: number; // novos seguidores no dia
}

export interface IgDemographics {
  locked: boolean;
  followersNeeded: number; // quantos faltam para 100 (0 se já desbloqueado)
  topCountries: { name: string; value: number }[];
  topCities: { name: string; value: number }[];
  genderAge: { name: string; value: number }[];
}

export interface IgAccountInsights {
  followerGrowth: IgFollowerPoint[];
  profileViews: number;
  reach28d: number;
}

export interface IgInsights {
  followersCount: number;
  mediaCount: number;
  username: string;
  profilePicture: string | null;
  posts: IgPostMetric[];
  account: IgAccountInsights | null;
  demographics: IgDemographics | null;
}

/** Lê uma métrica de insights da conta de forma defensiva (não lança). */
async function tryAccountMetric(
  igUserId: string,
  token: string,
  params: Record<string, string>
): Promise<{ name: string; values?: { value: number; end_time?: string }[]; total_value?: { value: number; breakdowns?: { results: { dimension_values: string[]; value: number }[] }[] } }[] | null> {
  try {
    const data = await gget<{
      data: {
        name: string;
        values?: { value: number; end_time?: string }[];
        total_value?: { value: number; breakdowns?: { results: { dimension_values: string[]; value: number }[] }[] };
      }[];
    }>(`/${igUserId}/insights`, { access_token: token, ...params });
    return data.data ?? null;
  } catch {
    return null;
  }
}

/** Insights de conta: crescimento de seguidores, visitas ao perfil, alcance. */
async function fetchAccountInsights(igUserId: string, token: string): Promise<IgAccountInsights> {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 30 * 24 * 3600;

  let followerGrowth: IgFollowerPoint[] = [];
  const fc = await tryAccountMetric(igUserId, token, {
    metric: "follower_count",
    period: "day",
    since: String(since),
    until: String(until),
  });
  const fcValues = fc?.find((m) => m.name === "follower_count")?.values;
  if (fcValues) {
    followerGrowth = fcValues.map((v) => ({
      date: v.end_time ?? "",
      value: v.value ?? 0,
    }));
  }

  let profileViews = 0;
  const pv = await tryAccountMetric(igUserId, token, {
    metric: "profile_views",
    period: "day",
    metric_type: "total_value",
    since: String(since),
    until: String(until),
  });
  profileViews = pv?.find((m) => m.name === "profile_views")?.total_value?.value ?? 0;

  let reach28d = 0;
  const rc = await tryAccountMetric(igUserId, token, {
    metric: "reach",
    period: "day",
    metric_type: "total_value",
    since: String(since),
    until: String(until),
  });
  reach28d = rc?.find((m) => m.name === "reach")?.total_value?.value ?? 0;

  return { followerGrowth, profileViews, reach28d };
}

/** Demografia do público — só liberada pela Meta a partir de 100 seguidores. */
async function fetchDemographics(
  igUserId: string,
  token: string,
  followersCount: number
): Promise<IgDemographics> {
  if (followersCount < 100) {
    return {
      locked: true,
      followersNeeded: 100 - followersCount,
      topCountries: [],
      topCities: [],
      genderAge: [],
    };
  }

  const breakdown = async (dim: string) => {
    const d = await tryAccountMetric(igUserId, token, {
      metric: "follower_demographics",
      period: "lifetime",
      metric_type: "total_value",
      breakdown: dim,
    });
    const results = d?.find((m) => m.name === "follower_demographics")?.total_value?.breakdowns?.[0]?.results ?? [];
    return results
      .map((r) => ({ name: r.dimension_values.join(" "), value: r.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const [topCountries, topCities, genderAge] = await Promise.all([
    breakdown("country"),
    breakdown("city"),
    breakdown("age"),
  ]);

  return { locked: false, followersNeeded: 0, topCountries, topCities, genderAge };
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

  // Lê insights de um post com a lista de métricas rica; se a Meta recusar
  // (algum tipo de mídia não suporta uma métrica), cai para o conjunto mínimo.
  async function postInsights(mediaId: string): Promise<Record<string, number>> {
    const parse = (data: { data?: { name: string; values?: { value: number }[] }[] }) => {
      const out: Record<string, number> = {};
      for (const metric of data.data ?? []) out[metric.name] = metric.values?.[0]?.value ?? 0;
      return out;
    };
    try {
      const ins = await gget<{ data: { name: string; values?: { value: number }[] }[] }>(
        `/${mediaId}/insights`,
        { metric: "reach,saved,shares,total_interactions,views", access_token: token }
      );
      return parse(ins);
    } catch {
      try {
        const ins = await gget<{ data: { name: string; values?: { value: number }[] }[] }>(
          `/${mediaId}/insights`,
          { metric: "reach,saved", access_token: token }
        );
        return parse(ins);
      } catch {
        return {};
      }
    }
  }

  const posts: IgPostMetric[] = [];
  for (const m of media.data ?? []) {
    const ins = await postInsights(m.id);
    posts.push({
      id: m.id,
      caption: m.caption?.slice(0, 120) ?? "",
      mediaType: m.media_type,
      mediaUrl: m.thumbnail_url ?? m.media_url ?? null,
      permalink: m.permalink,
      timestamp: m.timestamp,
      likes: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
      reach: ins.reach ?? 0,
      saved: ins.saved ?? 0,
      shares: ins.shares ?? 0,
      views: ins.views ?? 0,
      totalInteractions: ins.total_interactions ?? 0,
    });
  }

  const followersCount = acc.followers_count ?? 0;

  // Conta e demografia em paralelo (defensivos — nunca derrubam a página).
  const [account, demographics] = await Promise.all([
    fetchAccountInsights(igUserId, token).catch(() => null),
    fetchDemographics(igUserId, token, followersCount).catch(() => null),
  ]);

  return {
    followersCount,
    mediaCount: acc.media_count ?? 0,
    username: acc.username,
    profilePicture: acc.profile_picture_url ?? null,
    posts,
    account,
    demographics,
  };
}
