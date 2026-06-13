import {
  NICHES,
  REGION_CODE,
  RELEVANCE_LANGUAGE,
  type FetchedTrend,
} from "./sources";

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

interface SearchItem {
  id: { videoId: string };
}

interface VideoItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { high?: { url: string }; medium?: { url: string } };
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

function hoursSince(iso: string): number {
  return Math.max(1, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}

/**
 * Busca vídeos populares recentes por nicho no YouTube (região BR).
 * Requer YOUTUBE_API_KEY. Retorna [] se a chave não estiver configurada.
 */
export async function fetchYouTubeTrends(perNiche = 6): Promise<FetchedTrend[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];

  const publishedAfter = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const results: FetchedTrend[] = [];

  for (const niche of NICHES) {
    try {
      // 1. Search recent videos by topic (ordered by view count)
      const searchParams = new URLSearchParams({
        part: "snippet",
        q: niche.youtubeQuery,
        type: "video",
        order: "viewCount",
        regionCode: REGION_CODE,
        relevanceLanguage: RELEVANCE_LANGUAGE,
        publishedAfter,
        maxResults: String(perNiche),
        key,
      });

      const searchRes = await fetch(`${SEARCH_URL}?${searchParams}`, {
        next: { revalidate: 3600 },
      });
      if (!searchRes.ok) continue;
      const searchData = (await searchRes.json()) as { items?: SearchItem[] };
      const ids = (searchData.items ?? [])
        .map((i) => i.id?.videoId)
        .filter(Boolean);
      if (ids.length === 0) continue;

      // 2. Fetch statistics for those videos
      const videosParams = new URLSearchParams({
        part: "snippet,statistics",
        id: ids.join(","),
        key,
      });
      const videosRes = await fetch(`${VIDEOS_URL}?${videosParams}`, {
        next: { revalidate: 3600 },
      });
      if (!videosRes.ok) continue;
      const videosData = (await videosRes.json()) as { items?: VideoItem[] };

      for (const v of videosData.items ?? []) {
        const views = Number(v.statistics.viewCount ?? 0);
        const likes = Number(v.statistics.likeCount ?? 0);
        const comments = Number(v.statistics.commentCount ?? 0);
        const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
        const velocityPerHour = views / hoursSince(v.snippet.publishedAt);

        results.push({
          source: "youtube",
          externalId: v.id,
          niche: niche.id,
          title: v.snippet.title,
          description: v.snippet.description?.slice(0, 500) ?? null,
          sourceUrl: `https://www.youtube.com/watch?v=${v.id}`,
          thumbnailUrl:
            v.snippet.thumbnails.high?.url ?? v.snippet.thumbnails.medium?.url ?? null,
          author: v.snippet.channelTitle,
          platform: "youtube",
          format: "reel",
          publishedAt: v.snippet.publishedAt,
          metrics: {
            views,
            likes,
            comments,
            engagementRate: Number(engagementRate.toFixed(2)),
            velocityPerHour: Math.round(velocityPerHour),
          },
        });
      }
    } catch (err) {
      console.error(`[youtube] niche ${niche.id} failed:`, err);
    }
  }

  return results;
}
