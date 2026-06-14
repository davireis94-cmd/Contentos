import { runActor } from "./apify";
import { NICHES, type FetchedTrend, type NicheConfig } from "./sources";

const ACTOR = "clockworks~free-tiktok-scraper";

/** Converte um item do Apify (TikTok) em FetchedTrend. Retorna null se inválido. */
function mapTtItem(it: TtItem, niche: string, isReference: boolean): FetchedTrend | null {
  if (!it.id || !it.webVideoUrl) return null;
  const likes = it.diggCount ?? 0;
  const comments = it.commentCount ?? 0;
  const views = it.playCount ?? 0;
  const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const author = it.authorMeta?.name ?? it.authorMeta?.nickName ?? null;

  return {
    source: "tiktok",
    externalId: it.id,
    niche,
    title: it.text?.slice(0, 140) || `Vídeo de @${author ?? "tiktok"}`,
    description: it.text?.slice(0, 500) ?? null,
    sourceUrl: it.webVideoUrl,
    thumbnailUrl: it.videoMeta?.coverUrl ?? it.covers?.[0] ?? null,
    author: author ? `@${author}` : null,
    platform: "tiktok",
    format: "reel",
    publishedAt: it.createTimeISO ?? null,
    isReference,
    metrics: {
      likes,
      comments,
      ...(views > 0 ? { views } : {}),
      ...(it.collectCount ? { saved: it.collectCount } : {}),
      ...(engagementRate > 0 ? { engagementRate: Number(engagementRate.toFixed(2)) } : {}),
    },
  };
}

/** Virais recentes de perfis de referência escolhidos pelo usuário. */
export async function fetchTikTokProfiles(
  handles: string[],
  perProfile = 6
): Promise<FetchedTrend[]> {
  const clean = handles.map((h) => h.replace(/^@/, "").trim()).filter(Boolean).slice(0, 4);
  if (clean.length === 0) return [];

  const items = await runActor<TtItem>(ACTOR, {
    profiles: clean,
    resultsPerPage: perProfile,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
  });

  const results: FetchedTrend[] = [];
  for (const it of items) {
    const mapped = mapTtItem(it, `@${it.authorMeta?.name ?? "ref"}`, true);
    if (mapped) results.push(mapped);
  }
  return results;
}

interface TtItem {
  error?: string;
  errorCode?: string;
  id?: string;
  text?: string;
  createTimeISO?: string;
  webVideoUrl?: string;
  diggCount?: number; // likes
  shareCount?: number;
  playCount?: number; // views
  commentCount?: number;
  collectCount?: number; // saves
  authorMeta?: { name?: string; nickName?: string };
  videoMeta?: { coverUrl?: string };
  covers?: string[];
}

/** Hashtag real (palavra única, sem espaços/acentos) a partir da busca do nicho. */
function hashtagOf(niche: NicheConfig): string {
  if (niche.hashtag && niche.hashtag.length > 2) return niche.hashtag;
  return (
    niche.youtubeQuery
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .find((w) => w.length > 3) ?? ""
  );
}

/**
 * Tendências do TikTok por hashtag do nicho (Apify free-tiktok-scraper).
 * Limita nichos e resultados para caber no plano free.
 */
export async function fetchTikTokTrends(
  niches: NicheConfig[] = NICHES,
  perTag = 12
): Promise<FetchedTrend[]> {
  const tags = Array.from(
    new Set(niches.map(hashtagOf).filter((t) => t.length > 2))
  ).slice(0, 2);
  if (tags.length === 0) throw new Error("Sem hashtags do nicho (preencha os pilares no Brand Brain)");

  const items = await runActor<TtItem>(ACTOR, {
    hashtags: tags,
    resultsPerPage: perTag,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
  });

  const niche = niches[0]?.tag ?? niches[0]?.id ?? "tiktok";
  const mappedAll: FetchedTrend[] = [];
  for (const it of items) {
    const mapped = mapTtItem(it, niche, false);
    if (mapped) mappedAll.push(mapped);
  }
  // Piso de qualidade (TikTok é movido a views).
  const eng = (t: FetchedTrend) =>
    (t.metrics.views ?? 0) + (t.metrics.likes ?? 0) * 20 + (t.metrics.comments ?? 0) * 50;
  mappedAll.sort((a, b) => eng(b) - eng(a));
  const strong = mappedAll.filter((t) => (t.metrics.views ?? 0) >= 5000 || (t.metrics.likes ?? 0) >= 300);
  const results = strong.length >= 4 ? strong : mappedAll.slice(0, 8);

  // Diagnóstico: se veio dado mas nada mapeou, mostra o erro real p/ ajuste.
  if (results.length === 0) {
    if (items.length === 0) {
      throw new Error(`Apify OK, 0 itens para #${tags.join(", #")}`);
    }
    const errored = items.find((it) => it.error || it.errorCode);
    if (errored) {
      throw new Error(`Apify (tiktok): ${errored.error ?? errored.errorCode}`);
    }
    throw new Error(
      `Apify devolveu ${items.length} itens em formato inesperado. Campos: ${Object.keys(
        items[0] as object
      )
        .slice(0, 20)
        .join(",")}`
    );
  }
  return results;
}
