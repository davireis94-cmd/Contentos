import { createClient } from "@supabase/supabase-js";
import { fetchYouTubeTrends } from "./youtube";
import { fetchRedditTrends } from "./reddit";
import { NICHES, type FetchedTrend, type NicheConfig } from "./sources";

/**
 * Coleta tendências do YouTube + Reddit e faz upsert na benchmark_content
 * como linhas globais (workspace_id = NULL, visíveis a todos).
 * Usa service role para poder inserir linhas globais (RLS bypass).
 */
export async function syncTrends(
  niches: NicheConfig[] = NICHES
): Promise<{
  youtube: number;
  reddit: number;
  total: number;
  error?: string;
}> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return { youtube: 0, reddit: 0, total: 0, error: "SUPABASE_SERVICE_ROLE_KEY ausente" };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const [youtube, reddit] = await Promise.all([
    fetchYouTubeTrends(niches),
    fetchRedditTrends(niches),
  ]);

  const all: FetchedTrend[] = [...youtube, ...reddit];
  if (all.length === 0) {
    return { youtube: 0, reddit: 0, total: 0, error: "Nenhuma tendência coletada (verifique YOUTUBE_API_KEY)" };
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
    topic_tags: [t.niche],
    published_at: t.publishedAt,
    fetched_at: now,
    metrics: t.metrics,
  }));

  // Upsert on (source, external_id) so re-syncs refresh metrics instead of duplicating.
  const { error } = await admin
    .from("benchmark_content")
    .upsert(rows, { onConflict: "source,external_id", ignoreDuplicates: false });

  if (error) {
    return { youtube: youtube.length, reddit: reddit.length, total: 0, error: error.message };
  }

  return { youtube: youtube.length, reddit: reddit.length, total: all.length };
}
