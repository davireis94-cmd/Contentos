import { runActor } from "./apify";
import { NICHES, type FetchedTrend, type NicheConfig } from "./sources";

const ACTOR = "clockworks~free-tiktok-scraper";

interface TtItem {
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

/** Hashtag enxuta (sem espaços/acentos) a partir da busca do nicho. */
function hashtagOf(niche: NicheConfig): string {
  return niche.youtubeQuery
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .join("");
}

/**
 * Tendências do TikTok por hashtag do nicho (Apify free-tiktok-scraper).
 * Limita nichos e resultados para caber no plano free.
 */
export async function fetchTikTokTrends(
  niches: NicheConfig[] = NICHES,
  perTag = 12
): Promise<FetchedTrend[]> {
  if (!process.env.APIFY_TOKEN) return [];

  const tags = Array.from(
    new Set(niches.map(hashtagOf).filter((t) => t.length > 2))
  ).slice(0, 2);
  if (tags.length === 0) return [];

  let items: TtItem[] = [];
  try {
    items = await runActor<TtItem>(ACTOR, {
      hashtags: tags,
      resultsPerPage: perTag,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    });
  } catch (err) {
    console.error("[tiktok-trends] apify failed:", err);
    return [];
  }

  const results: FetchedTrend[] = [];
  for (const it of items) {
    if (!it.id || !it.webVideoUrl) continue;
    const likes = it.diggCount ?? 0;
    const comments = it.commentCount ?? 0;
    const views = it.playCount ?? 0;
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
    const author = it.authorMeta?.name ?? it.authorMeta?.nickName ?? null;

    results.push({
      source: "tiktok",
      externalId: it.id,
      niche: niches[0]?.tag ?? niches[0]?.id ?? "tiktok",
      title: it.text?.slice(0, 140) || `Vídeo de @${author ?? "tiktok"}`,
      description: it.text?.slice(0, 500) ?? null,
      sourceUrl: it.webVideoUrl,
      thumbnailUrl: it.videoMeta?.coverUrl ?? it.covers?.[0] ?? null,
      author: author ? `@${author}` : null,
      platform: "tiktok",
      format: "reel",
      publishedAt: it.createTimeISO ?? null,
      metrics: {
        likes,
        comments,
        ...(views > 0 ? { views } : {}),
        ...(it.collectCount ? { saved: it.collectCount } : {}),
        ...(engagementRate > 0 ? { engagementRate: Number(engagementRate.toFixed(2)) } : {}),
      },
    });
  }
  return results;
}
