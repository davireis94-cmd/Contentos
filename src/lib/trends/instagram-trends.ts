import { runActor } from "./apify";
import { NICHES, type FetchedTrend, type NicheConfig } from "./sources";

const ACTOR = "apify~instagram-hashtag-scraper";

interface IgItem {
  error?: string;
  errorDescription?: string;
  requestErrorMessages?: unknown;
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
  const tags = Array.from(
    new Set(niches.map(hashtagOf).filter((t) => t.length > 2))
  ).slice(0, 2); // no máx 2 hashtags p/ economizar crédito
  if (tags.length === 0) throw new Error("Sem hashtags do nicho (preencha os pilares no Brand Brain)");

  const items = await runActor<IgItem>(ACTOR, {
    hashtags: tags,
    resultsLimit: perTag,
  });

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

  // Diagnóstico: se veio dado mas nada mapeou, mostra os campos reais p/ ajuste.
  if (results.length === 0) {
    if (items.length === 0) {
      throw new Error(`Apify OK, 0 itens para #${tags.join(", #")}`);
    }
    const errored = items.find((it) => it.error || it.errorDescription || it.requestErrorMessages);
    if (errored) {
      const detail =
        errored.errorDescription ||
        errored.error ||
        JSON.stringify(errored.requestErrorMessages);
      throw new Error(`Apify (instagram): ${String(detail).slice(0, 250)}`);
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
