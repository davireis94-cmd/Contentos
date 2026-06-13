-- =============================================================
-- Conexões sociais (Instagram via Meta Graph API) — Fase 4 (métricas).
-- Guarda o token de acesso do usuário com RLS. O token NUNCA é lido
-- pelo cliente — só server-side (service role) ao buscar métricas.
-- =============================================================

create table if not exists social_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null,                 -- 'instagram'
  external_id text not null,              -- IG business account id
  username text,
  access_token text not null,             -- long-lived token (server-only)
  token_expires_at timestamptz,
  meta jsonb not null default '{}'::jsonb, -- followers_count, profile_pic, page_id...
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform)
);

alter table social_connections enable row level security;

-- Membros podem VER que existe conexão (mas o token nunca é selecionado no cliente).
drop policy if exists "select_social_connections" on social_connections;
create policy "select_social_connections"
  on social_connections for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Membros podem desconectar (deletar) a conexão do próprio workspace.
drop policy if exists "delete_social_connections" on social_connections;
create policy "delete_social_connections"
  on social_connections for delete
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );
