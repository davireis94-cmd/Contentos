-- ============================================================================
--  ATIVAÇÃO — Passo 1 (Supabase)
--  Cole TUDO isto no SQL Editor do Supabase e clique em "Run".
--  É seguro rodar mais de uma vez (não quebra nada se já tiver rodado).
-- ============================================================================

-- 0) Cria a tabela de Tendências & Referências (se ainda não existir)
create table if not exists benchmark_content (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  format text not null default 'carousel',
  platform text not null default 'instagram',
  title text not null,
  description text,
  source_url text,
  thumbnail_url text,
  topic_tags text[] not null default '{}',
  notes text,
  transcript text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);
alter table benchmark_content enable row level security;

drop policy if exists "select_benchmark_content" on benchmark_content;
create policy "select_benchmark_content"
  on benchmark_content for select
  using (
    workspace_id is null
    or workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

drop policy if exists "insert_benchmark_content" on benchmark_content;
create policy "insert_benchmark_content"
  on benchmark_content for insert
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

drop policy if exists "delete_benchmark_content" on benchmark_content;
create policy "delete_benchmark_content"
  on benchmark_content for delete
  using (added_by = auth.uid());

-- 1) Ledger de uso/custo (painel de Créditos)
alter table usage_logs alter column type drop not null;
alter table usage_logs add column if not exists operation     text;
alter table usage_logs add column if not exists model         text;
alter table usage_logs add column if not exists tokens_input  integer not null default 0;
alter table usage_logs add column if not exists tokens_output integer not null default 0;
alter table usage_logs add column if not exists units         numeric(12,4) not null default 0;
alter table usage_logs add column if not exists unit_type     text;
alter table usage_logs add column if not exists credits       numeric(12,4) not null default 0;
alter table usage_logs add column if not exists status        text not null default 'success';
alter table usage_logs add column if not exists metadata      jsonb not null default '{}'::jsonb;
alter table usage_logs add column if not exists window_bucket text;
create index if not exists idx_usage_logs_ws_op_time
  on usage_logs (workspace_id, operation, created_at desc);
create index if not exists idx_usage_logs_ws_bucket_time
  on usage_logs (workspace_id, window_bucket, created_at desc)
  where window_bucket is not null;

-- 2) Métricas das tendências (YouTube/Reddit)
alter table benchmark_content add column if not exists source       text not null default 'manual';
alter table benchmark_content add column if not exists external_id  text;
alter table benchmark_content add column if not exists niche        text;
alter table benchmark_content add column if not exists author       text;
alter table benchmark_content add column if not exists published_at timestamptz;
alter table benchmark_content add column if not exists fetched_at   timestamptz;
alter table benchmark_content add column if not exists metrics      jsonb not null default '{}'::jsonb;
drop index if exists idx_benchmark_source_external;
create unique index if not exists idx_benchmark_source_external
  on benchmark_content (source, external_id);
create index if not exists idx_benchmark_source_fetched
  on benchmark_content (source, fetched_at desc) where source <> 'manual';

-- 3) Armário das imagens geradas por IA (Storage)
insert into storage.buckets (id, name, public)
values ('slide-images', 'slide-images', true)
on conflict (id) do nothing;
drop policy if exists "slide_images_public_read" on storage.objects;
create policy "slide_images_public_read"
  on storage.objects for select
  using (bucket_id = 'slide-images');

-- 4) Conexões sociais (Instagram — métricas / Fase 4)
create table if not exists social_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null,
  external_id text not null,
  username text,
  access_token text not null,
  token_expires_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform)
);
alter table social_connections enable row level security;
drop policy if exists "select_social_connections" on social_connections;
create policy "select_social_connections"
  on social_connections for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));
drop policy if exists "delete_social_connections" on social_connections;
create policy "delete_social_connections"
  on social_connections for delete
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));
