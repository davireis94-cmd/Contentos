create table benchmark_content (
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

-- Any logged-in user sees global (workspace_id IS NULL) + their workspace content
create policy "select_benchmark_content"
  on benchmark_content for select
  using (
    workspace_id is null
    or workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Users can add to their own workspace
create policy "insert_benchmark_content"
  on benchmark_content for insert
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Users can delete entries they added
create policy "delete_benchmark_content"
  on benchmark_content for delete
  using (added_by = auth.uid());
