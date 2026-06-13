import { NICHES, type FetchedTrend } from "./sources";

interface RedditChild {
  data: {
    id: string;
    title: string;
    selftext?: string;
    permalink: string;
    url: string;
    author: string;
    ups: number;
    num_comments: number;
    created_utc: number;
    thumbnail?: string;
    preview?: { images?: { source?: { url: string } }[] };
  };
}

function hoursSinceUnix(sec: number): number {
  return Math.max(1, (Date.now() / 1000 - sec) / 3600);
}

/**
 * Busca posts em alta nos subreddits de cada nicho.
 * Não requer chave (JSON público), mas precisa de User-Agent.
 */
export async function fetchRedditTrends(perSub = 4): Promise<FetchedTrend[]> {
  const results: FetchedTrend[] = [];

  for (const niche of NICHES) {
    for (const sub of niche.subreddits) {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=${perSub}&raw_json=1`,
          {
            headers: { "User-Agent": "Lumio/1.0 (content trends aggregator)" },
            next: { revalidate: 3600 },
          }
        );
        if (!res.ok) continue;
        const data = (await res.json()) as { data?: { children?: RedditChild[] } };

        for (const child of data.data?.children ?? []) {
          const p = child.data;
          if (!p.title) continue;

          const thumb =
            p.preview?.images?.[0]?.source?.url ??
            (p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : null);

          const velocityPerHour = p.ups / hoursSinceUnix(p.created_utc);

          results.push({
            source: "reddit",
            externalId: p.id,
            niche: niche.id,
            title: p.title,
            description: p.selftext?.slice(0, 500) || null,
            sourceUrl: `https://www.reddit.com${p.permalink}`,
            thumbnailUrl: thumb,
            author: `u/${p.author} · r/${sub}`,
            platform: "reddit",
            format: "post",
            publishedAt: new Date(p.created_utc * 1000).toISOString(),
            metrics: {
              ups: p.ups,
              comments: p.num_comments,
              velocityPerHour: Math.round(velocityPerHour),
            },
          });
        }
      } catch (err) {
        console.error(`[reddit] r/${sub} failed:`, err);
      }
    }
  }

  return results;
}
