-- Storage bucket for payment method logos
-- Run this in Supabase SQL editor after creating the bucket via Storage API

-- Policies for payment-method-logos bucket
drop policy if exists "payment_method_logos public read" on storage.objects;
create policy "payment_method_logos public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'payment-method-logos');

drop policy if exists "payment_method_logos admin upload" on storage.objects;
create policy "payment_method_logos admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-method-logos');

drop policy if exists "payment_method_logos admin delete" on storage.objects;
create policy "payment_method_logos admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-method-logos');
