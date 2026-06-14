import { NICHES, type FetchedTrend } from "./sources";

interface RedditChild {
  data: {
    id: string;
    title: string;
    selftext?: string;
    permalink: string;
    url: string;
    author: string;
    subreddit?: string;
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

/** Obtém token OAuth app-only do Reddit (client_credentials). */
async function getRedditToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Lumio/1.0 (content trends aggregator)",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Busca posts em alta nos subreddits de cada nicho.
 * Usa OAuth app-only se REDDIT_CLIENT_ID/SECRET estiverem configurados;
 * caso contrário tenta a API pública (bloqueada em IPs de datacenter).
 */
export async function fetchRedditTrends(
  niches: typeof NICHES = NICHES,
  perSub = 4
): Promise<FetchedTrend[]> {
  const token = await getRedditToken();
  const baseUrl = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const headers: Record<string, string> = {
    "User-Agent": "Lumio/1.0 (content trends aggregator)",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const results: FetchedTrend[] = [];

  for (const niche of niches) {
    const endpoints = niche.subreddits.length
      ? niche.subreddits.map((sub) => ({
          sub,
          url: `${baseUrl}/r/${sub}/hot.json?limit=${perSub}&raw_json=1`,
        }))
      : [
          {
            sub: "search",
            url: `${baseUrl}/search.json?q=${encodeURIComponent(
              niche.youtubeQuery
            )}&sort=top&t=month&limit=${perSub}&raw_json=1`,
          },
        ];

    for (const { sub, url } of endpoints) {
      try {
        const res = await fetch(url, { headers, next: { revalidate: 3600 } });
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
            niche: niche.tag ?? niche.id,
            title: p.title,
            description: p.selftext?.slice(0, 500) || null,
            sourceUrl: `https://www.reddit.com${p.permalink}`,
            thumbnailUrl: thumb,
            author: `u/${p.author} · r/${p.subreddit ?? sub}`,
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
