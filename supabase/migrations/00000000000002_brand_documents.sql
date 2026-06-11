-- Brand Documents — V2
-- Stores uploaded brand PDFs + AI-extracted context

create table if not exists brand_documents (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  storage_path text not null,
  file_type text not null default 'application/pdf',
  file_size_bytes bigint,
  extracted_content text,   -- JSON string from Claude extraction
  created_at timestamptz not null default now()
);

create index if not exists idx_brand_documents_brand on brand_documents (brand_id);

alter table brand_documents enable row level security;

create policy "workspace members can manage their documents"
  on brand_documents for all
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Storage RLS for brand-docs bucket
create policy "workspace members can upload brand docs"
  on storage.objects for insert
  with check (bucket_id = 'brand-docs' and auth.uid() is not null);

create policy "workspace members can read brand docs"
  on storage.objects for select
  using (bucket_id = 'brand-docs' and auth.uid() is not null);

create policy "workspace members can delete brand docs"
  on storage.objects for delete
  using (bucket_id = 'brand-docs' and auth.uid() is not null);
