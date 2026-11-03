-- Migration 048: Remove seeded test data.
-- Deletes the test platform-admin accounts that were created by the old
-- seed-business-owners migration. Cascades remove their profiles and any
-- businesses/restaurants they own.

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id
  FROM auth.users
  WHERE email IN ('normsii@kai-pos.com', '24kai@kai-pos.com')
);

DELETE FROM auth.users
WHERE email IN ('normsii@kai-pos.com', '24kai@kai-pos.com');
