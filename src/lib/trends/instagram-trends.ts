import { runActor } from "./apify";
import { NICHES, type FetchedTrend, type NicheConfig } from "./sources";

const ACTOR = "apify~instagram-hashtag-scraper";

interface IgItem {
  id?: string;
  shortCode?: string;
  type?: string; // Image | Video | Sidecar
  productType?: string; // clips (reels) | feed | igtv
  caption?: string;
  url?: string;
  displayUrl?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  ownerUsername?: string;
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

function mapFormat(it: IgItem): string {
  if (it.productType === "clips" || it.type === "Video") return "reel";
  if (it.type === "Sidecar") return "carousel";
  return "single";
}

/**
 * Tendências do Instagram por hashtag do nicho (Apify, pago/econômico).
 * Limita nichos e resultados para caber no plano free (~US$5/mês).
 */
export async function fetchInstagramTrends(
  niches: NicheConfig[] = NICHES,
  perTag = 12
): Promise<FetchedTrend[]> {
  if (!process.env.APIFY_TOKEN) return [];

  const tags = Array.from(
    new Set(niches.map(hashtagOf).filter((t) => t.length > 2))
  ).slice(0, 2); // no máx 2 hashtags p/ economizar crédito
  if (tags.length === 0) return [];

  let items: IgItem[] = [];
  try {
    items = await runActor<IgItem>(ACTOR, {
      hashtags: tags,
      resultsLimit: perTag,
    });
  } catch (err) {
    console.error("[instagram-trends] apify failed:", err);
    return [];
  }

  const results: FetchedTrend[] = [];
  for (const it of items) {
    const id = it.shortCode ?? it.id;
    if (!id || !it.url) continue;
    const likes = it.likesCount ?? 0;
    const comments = it.commentsCount ?? 0;
    const views = it.videoPlayCount ?? it.videoViewCount ?? 0;
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

    results.push({
      source: "instagram",
      externalId: id,
      niche: niches[0]?.tag ?? niches[0]?.id ?? "instagram",
      title: it.caption?.slice(0, 140) || `Post de @${it.ownerUsername ?? "instagram"}`,
      description: it.caption?.slice(0, 500) ?? null,
      sourceUrl: it.url,
      thumbnailUrl: it.displayUrl ?? null,
      author: it.ownerUsername ? `@${it.ownerUsername}` : null,
      platform: "instagram",
      format: mapFormat(it),
      publishedAt: it.timestamp ?? null,
      metrics: {
        likes,
        comments,
        ...(views > 0 ? { views } : {}),
        ...(engagementRate > 0 ? { engagementRate: Number(engagementRate.toFixed(2)) } : {}),
      },
    });
  }
  return results;
}
