-- =============================================================
-- Usage / Cost Tracking — extends usage_logs into a full ledger
-- Each AI operation logs: model, tokens, real USD cost, credits charged,
-- and a window bucket (for Claude-style rolling caps on expensive ops).
-- =============================================================

-- The original `type` column is a narrow enum that doesn't cover our real
-- operations, and inserts using it were silently failing. Make it nullable
-- and rely on the new text `operation` column as the real key.
alter table usage_logs alter column type drop not null;

alter table usage_logs add column if not exists operation     text;
alter table usage_logs add column if not exists model         text;
alter table usage_logs add column if not exists tokens_input  integer not null default 0;
alter table usage_logs add column if not exists tokens_output integer not null default 0;
alter table usage_logs add column if not exists units         numeric(12,4) not null default 0;
alter table usage_logs add column if not exists unit_type     text;     -- 'image' | 'video_second' | 'tts_char' | null
alter table usage_logs add column if not exists credits       numeric(12,4) not null default 0;
alter table usage_logs add column if not exists status        text not null default 'success';
alter table usage_logs add column if not exists metadata      jsonb not null default '{}'::jsonb;

-- Window bucket: which rolling-cap pool this op counts against
-- (e.g. 'video_kling' | 'video_premium' | null for un-capped ops).
alter table usage_logs add column if not exists window_bucket text;

-- Fast lookups for monthly rollups and rolling-window cap checks.
create index if not exists idx_usage_logs_ws_op_time
  on usage_logs (workspace_id, operation, created_at desc);

create index if not exists idx_usage_logs_ws_bucket_time
  on usage_logs (workspace_id, window_bucket, created_at desc)
  where window_bucket is not null;
