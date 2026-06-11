-- =============================================================
-- 1) Workspace owner must be able to SELECT the workspace right
--    after INSERT (before the membership row exists), otherwise
--    onboarding breaks under RLS.
-- 2) Storage bucket for brand assets (logos) with workspace-
--    scoped write policies and public read.
-- =============================================================

drop policy "workspaces_select_member" on workspaces;
create policy "workspaces_select_member_or_owner" on workspaces
  for select using (is_workspace_member(id) or owner_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

-- object path convention: {workspace_id}/{brand_id}/{filename}
create policy "brand_assets_read_public" on storage.objects
  for select using (bucket_id = 'brand-assets');

create policy "brand_assets_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'brand-assets'
    and auth.role() = 'authenticated'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "brand_assets_update_member" on storage.objects
  for update using (
    bucket_id = 'brand-assets'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "brand_assets_delete_member" on storage.objects
  for delete using (
    bucket_id = 'brand-assets'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
