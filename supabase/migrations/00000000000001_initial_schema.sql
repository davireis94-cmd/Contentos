-- =============================================================
-- Content OS — Initial Schema (V1)
-- Workspace -> Brands -> Content model with pgvector brand memory
-- =============================================================

create extension if not exists vector;

-- -------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------
create type plan_tier as enum ('free', 'starter', 'pro');
create type member_role as enum ('owner', 'admin', 'editor');
create type brand_tone as enum ('formal', 'conversational', 'authority', 'minimalist');
create type content_format as enum ('carousel', 'reel', 'story', 'single');
create type content_status as enum ('idea', 'scripted', 'editing', 'scheduled', 'published');
create type platform_type as enum ('instagram', 'tiktok', 'youtube', 'linkedin', 'x');
create type template_category as enum ('business', 'ai', 'marketing', 'sales', 'productivity', 'leadership');
create type usage_type as enum ('text_generation', 'image_generation', 'embedding');
create type subscription_status as enum ('active', 'past_due', 'canceled', 'trialing');

-- -------------------------------------------------------------
-- Profiles (mirror of auth.users)
-- -------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Workspaces & membership
-- -------------------------------------------------------------
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users (id),
  plan plan_tier not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'editor',
  invited_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index idx_workspace_members_user on workspace_members (user_id);

-- -------------------------------------------------------------
-- Brands (Brand Brain)
-- -------------------------------------------------------------
create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  description text,
  logo_url text,
  website text,
  -- identity: { colors: [{ hex, role }], fonts: { heading, body } }
  identity jsonb not null default '{}'::jsonb,
  brand_score smallint not null default 0 check (brand_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_brands_workspace on brands (workspace_id);

create table brand_voice (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references brands (id) on delete cascade,
  tone brand_tone not null default 'conversational',
  forbidden_words text[] not null default '{}',
  characteristic_phrases text[] not null default '{}',
  target_audience text,
  content_pillars text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table brand_references (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  name text not null,
  handle text,
  platforms platform_type[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create index idx_brand_references_brand on brand_references (brand_id);

-- Embeddings: Gemini gemini-embedding-001 with output_dimensionality=1536
create table brand_examples (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  content text not null,
  image_url text,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_brand_examples_brand on brand_examples (brand_id);
create index idx_brand_examples_embedding on brand_examples
  using hnsw (embedding vector_cosine_ops);

-- -------------------------------------------------------------
-- Content (canonical piece + per-platform instances)
-- -------------------------------------------------------------
create table content_pieces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  brand_id uuid not null references brands (id) on delete cascade,
  title text not null,
  format content_format not null,
  status content_status not null default 'idea',
  pillar text,
  objective text,
  -- slides: [{ index, title, subtitle, body, cta }]
  slides jsonb not null default '[]'::jsonb,
  caption text,
  hashtags text[] not null default '{}',
  polotno_state jsonb,
  is_favorite boolean not null default false,
  -- gantt: production window start; scheduled_at lives on platform_posts
  start_date timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_content_pieces_workspace on content_pieces (workspace_id);
create index idx_content_pieces_brand on content_pieces (brand_id);
create index idx_content_pieces_status on content_pieces (workspace_id, status);

create table platform_posts (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid not null references content_pieces (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  platform platform_type not null,
  status content_status not null default 'idea',
  caption_override text,
  scheduled_at timestamptz,
  published_at timestamptz,
  -- external_id: platform post id once Publisher (V3) goes live
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_piece_id, platform)
);

create index idx_platform_posts_workspace on platform_posts (workspace_id);
create index idx_platform_posts_scheduled on platform_posts (workspace_id, scheduled_at);

-- -------------------------------------------------------------
-- Templates (global, admin-managed)
-- -------------------------------------------------------------
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category template_category not null,
  preview_url text,
  polotno_state jsonb not null,
  is_premium boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table template_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references templates (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id)
);

-- -------------------------------------------------------------
-- Billing & usage
-- -------------------------------------------------------------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspaces (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan plan_tier not null default 'free',
  status subscription_status not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table usage_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid references auth.users (id),
  type usage_type not null,
  tokens_used integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_usage_logs_workspace_month on usage_logs (workspace_id, created_at);

-- -------------------------------------------------------------
-- Helpers
-- -------------------------------------------------------------

-- security definer avoids RLS recursion when policies check membership
create or replace function is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on profiles
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on workspaces
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on brands
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on brand_voice
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on content_pieces
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on platform_posts
  for each row execute function handle_updated_at();
create trigger set_updated_at before update on subscriptions
  for each row execute function handle_updated_at();

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- semantic search over brand examples (used by the generator)
create or replace function match_brand_examples(
  p_brand_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5
)
returns table (id uuid, content text, similarity float)
language sql
stable
as $$
  select
    be.id,
    be.content,
    1 - (be.embedding <=> p_query_embedding) as similarity
  from brand_examples be
  where be.brand_id = p_brand_id
    and be.embedding is not null
  order by be.embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- -------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table brands enable row level security;
alter table brand_voice enable row level security;
alter table brand_references enable row level security;
alter table brand_examples enable row level security;
alter table content_pieces enable row level security;
alter table platform_posts enable row level security;
alter table templates enable row level security;
alter table template_favorites enable row level security;
alter table subscriptions enable row level security;
alter table usage_logs enable row level security;

-- profiles: users manage their own
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- workspaces
create policy "workspaces_select_member" on workspaces
  for select using (is_workspace_member(id));
create policy "workspaces_insert_own" on workspaces
  for insert with check (owner_id = auth.uid());
create policy "workspaces_update_owner" on workspaces
  for update using (owner_id = auth.uid());
create policy "workspaces_delete_owner" on workspaces
  for delete using (owner_id = auth.uid());

-- workspace_members
create policy "members_select_member" on workspace_members
  for select using (is_workspace_member(workspace_id));
create policy "members_insert_owner" on workspace_members
  for insert with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
    or user_id = auth.uid() -- allow self-insert when creating own workspace
  );
create policy "members_delete_owner_or_self" on workspace_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- brands and children: scoped via workspace membership
create policy "brands_all_member" on brands
  for all using (is_workspace_member(workspace_id));

create policy "brand_voice_all_member" on brand_voice
  for all using (
    exists (
      select 1 from brands b
      where b.id = brand_voice.brand_id and is_workspace_member(b.workspace_id)
    )
  );

create policy "brand_references_all_member" on brand_references
  for all using (
    exists (
      select 1 from brands b
      where b.id = brand_references.brand_id and is_workspace_member(b.workspace_id)
    )
  );

create policy "brand_examples_all_member" on brand_examples
  for all using (
    exists (
      select 1 from brands b
      where b.id = brand_examples.brand_id and is_workspace_member(b.workspace_id)
    )
  );

-- content
create policy "content_pieces_all_member" on content_pieces
  for all using (is_workspace_member(workspace_id));

create policy "platform_posts_all_member" on platform_posts
  for all using (is_workspace_member(workspace_id));

-- templates: public read, admin write via service role only
create policy "templates_select_all" on templates
  for select using (true);

create policy "template_favorites_all_own" on template_favorites
  for all using (user_id = auth.uid());

-- billing: members read, writes via service role (Stripe webhooks) only
create policy "subscriptions_select_member" on subscriptions
  for select using (is_workspace_member(workspace_id));

create policy "usage_logs_select_member" on usage_logs
  for select using (is_workspace_member(workspace_id));
