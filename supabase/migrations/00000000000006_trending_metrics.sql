-- =============================================================
-- Trending metrics — extends benchmark_content to hold auto-fetched
-- market trends (YouTube, Reddit) alongside manually-curated references.
-- Global trends use workspace_id = NULL (visible to everyone).
-- =============================================================

alter table benchmark_content add column if not exists source       text not null default 'manual'; -- manual | youtube | reddit
alter table benchmark_content add column if not exists external_id  text;        -- platform video/post id (dedup key)
alter table benchmark_content add column if not exists niche        text;        -- marketing | empreendedorismo | ia ...
alter table benchmark_content add column if not exists author       text;
alter table benchmark_content add column if not exists published_at timestamptz;
alter table benchmark_content add column if not exists fetched_at   timestamptz;
alter table benchmark_content add column if not exists metrics      jsonb not null default '{}'::jsonb;
-- metrics shape: { views, likes, comments, ups, engagementRate, velocityPerHour }

-- Dedup key for upsert on re-sync. Must be a FULL (non-partial) unique index so
-- Postgres ON CONFLICT (source, external_id) can use it as the arbiter.
-- Manual rows have external_id NULL; multiple NULLs are allowed (NULLs distinct).
create unique index if not exists idx_benchmark_source_external
  on benchmark_content (source, external_id);

-- Fast filtering of auto-fetched trends by recency.
create index if not exists idx_benchmark_source_fetched
  on benchmark_content (source, fetched_at desc)
  where source <> 'manual';

-- Allow anyone to read global trends (workspace_id NULL) — already covered by
-- existing select policy, which permits workspace_id IS NULL.
