-- Migration 048: Remove seeded test data.
-- Deletes the two test platform-admin accounts created by the old
-- seed-business-owners migration. The profile rows are removed explicitly so
-- this also works on schemas without the auth.users cascade.

DELETE FROM public.users
WHERE email IN ('normsii@kai-pos.com', '24kai@kai-pos.com');

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id
  FROM auth.users
  WHERE email IN ('normsii@kai-pos.com', '24kai@kai-pos.com')
);

DELETE FROM auth.users
WHERE email IN ('normsii@kai-pos.com', '24kai@kai-pos.com');
