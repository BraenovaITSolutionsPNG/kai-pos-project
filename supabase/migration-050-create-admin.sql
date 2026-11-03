-- Migration 050: Create a platform admin account.
-- Run this in the Supabase SQL Editor.
-- Login: admin@kai-pos.com / Admin123!
-- (Change the password after first login.)

-- Ensure pgcrypto is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create the auth user (staff_only=true skips business creation)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  instance_id
)
VALUES (
  gen_random_uuid(),
  'admin@kai-pos.com',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  '{"full_name": "Platform Admin", "staff_only": "true"}'::jsonb,
  now(),
  now(),
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (email) DO NOTHING;

-- 2. The trigger (handle_new_user) creates a public.users row.
--    Now set is_platform_admin = true for this user.
UPDATE public.users
SET is_platform_admin = true
WHERE email = 'admin@kai-pos.com';

-- 3. Create an identity record so the user can log in with password
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
FROM auth.users
WHERE email = 'admin@kai-pos.com'
  AND id NOT IN (SELECT user_id FROM auth.identities WHERE provider = 'email')
ON CONFLICT DO NOTHING;

-- Verify:
-- SELECT id, email, is_platform_admin FROM public.users WHERE is_platform_admin = true;
