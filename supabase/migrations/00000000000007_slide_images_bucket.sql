-- =============================================================
-- Storage bucket público para imagens de fundo geradas por IA.
-- Upload feito server-side com service role; leitura pública.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('slide-images', 'slide-images', true)
on conflict (id) do nothing;

-- Leitura pública (bucket já é public=true, mas a policy explícita garante).
create policy "slide_images_public_read"
  on storage.objects for select
  using (bucket_id = 'slide-images');
