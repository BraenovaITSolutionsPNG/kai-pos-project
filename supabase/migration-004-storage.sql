-- Migration 004: storage policies for the payment-proofs bucket.
-- The bucket itself is created public via the Storage API; these policies
-- let signed-in owners attach proof screenshots while anyone (admins,
-- owners reviewing history) can view them.

create policy "authenticated can upload payment proofs"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'payment-proofs');

create policy "public can view payment proofs"
  on storage.objects
  for select
  to public
  using (bucket_id = 'payment-proofs');
