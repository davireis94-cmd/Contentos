import { createClient } from "@supabase/supabase-js";
import { fetchYouTubeTrends } from "./youtube";
import { fetchRedditTrends } from "./reddit";
import { fetchInstagramTrends, fetchInstagramProfiles } from "./instagram-trends";
import { fetchTikTokTrends, fetchTikTokProfiles } from "./tiktok-trends";
import { NICHES, type FetchedTrend, type NicheConfig } from "./sources";

export type TrendPlatform = "youtube" | "reddit" | "instagram" | "tiktok";

export interface ReferenceProfiles {
  instagram: string[];
  tiktok: string[];
}

export interface SyncResult {
  youtube: number;
  reddit: number;
  instagram: number;
  tiktok: number;
  total: number;
  error?: string;
}

/**
 * Coleta tendências das plataformas pedidas e faz upsert na benchmark_content
 * como linhas globais (workspace_id = NULL). YouTube/Reddit são grátis;
 * Instagram/TikTok usam Apify (pago) — por isso só rodam quando solicitados.
 */
export async function syncTrends(
  niches: NicheConfig[] = NICHES,
  platforms: TrendPlatform[] = ["youtube", "reddit"],
  profiles: ReferenceProfiles = { instagram: [], tiktok: [] }
): Promise<SyncResult> {
  const empty: SyncResult = { youtube: 0, reddit: 0, instagram: 0, tiktok: 0, total: 0 };
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return { ...empty, error: "SUPABASE_SERVICE_ROLE_KEY ausente" };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const want = new Set(platforms);
  const errors: string[] = [];
  const guard = async (
    name: TrendPlatform,
    fn: () => Promise<FetchedTrend[]>
  ): Promise<FetchedTrend[]> => {
    if (!want.has(name)) return [];
    try {
      return await fn();
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  };

  const [youtube, reddit, instagram, tiktok] = await Promise.all([
    guard("youtube", () => fetchYouTubeTrends(niches)),
    guard("reddit", () => fetchRedditTrends(niches)),
    guard("instagram", async () => {
      const [tags, refs] = await Promise.all([
        fetchInstagramTrends(niches),
        profiles.instagram.length
          ? fetchInstagramProfiles(profiles.instagram).catch(() => [])
          : Promise.resolve([]),
      ]);
      return [...refs, ...tags];
    }),
    guard("tiktok", async () => {
      const [tags, refs] = await Promise.all([
        fetchTikTokTrends(niches),
        profiles.tiktok.length
          ? fetchTikTokProfiles(profiles.tiktok).catch(() => [])
          : Promise.resolve([]),
      ]);
      return [...refs, ...tags];
    }),
  ]);

  const all: FetchedTrend[] = [...youtube, ...reddit, ...instagram, ...tiktok];
  if (all.length === 0) {
    return {
      ...empty,
      error: errors.length
        ? errors.join(" | ")
        : "Nenhuma tendência coletada (nada retornado da fonte)",
    };
  }

  const now = new Date().toISOString();
  const rows = all.map((t) => ({
    workspace_id: null,
    added_by: null,
    source: t.source,
    external_id: t.externalId,
    niche: t.niche,
    title: t.title,
    description: t.description,
    source_url: t.sourceUrl,
    thumbnail_url: t.thumbnailUrl,
    author: t.author,
    platform: t.platform,
    format: t.format,
    topic_tags: t.isReference ? ["referencia", t.niche] : [t.niche],
    published_at: t.publishedAt,
    fetched_at: now,
    metrics: t.metrics,
  }));

  // Upsert on (source, external_id) so re-syncs refresh metrics instead of duplicating.
  const { error } = await admin
    .from("benchmark_content")
    .upsert(rows, { onConflict: "source,external_id", ignoreDuplicates: false });

  const counts = {
    youtube: youtube.length,
    reddit: reddit.length,
    instagram: instagram.length,
    tiktok: tiktok.length,
  };

  if (error) {
    return { ...counts, total: 0, error: error.message };
  }

  return { ...counts, total: all.length };
}
