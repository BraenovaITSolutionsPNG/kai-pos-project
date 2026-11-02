-- Seed business owners into the database
-- Creates Normsii's KnitKnots and 24 KaiKai as platform admins

-- Insert into auth.users (trigger creates public.users with staff_only=true)
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'normsii@kai-pos.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('full_name', 'Normsii''s KnitKnots', 'staff_only', 'true'),
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'normsii@kai-pos.com'
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  '24kai@kai-pos.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('full_name', '24 KaiKai', 'staff_only', 'true'),
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = '24kai@kai-pos.com'
);

-- Create auth.identities for login support
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
SELECT
  u.id,
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
FROM auth.users u
WHERE u.email IN ('normsii@kai-pos.com', '24kai@kai-pos.com')
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
  );

-- Update public.users to set is_platform_admin = true
UPDATE public.users
SET is_platform_admin = true,
    full_name = CASE email
      WHEN 'normsii@kai-pos.com' THEN 'Normsii''s KnitKnots'
      WHEN '24kai@kai-pos.com' THEN '24 KaiKai'
      ELSE full_name
    END
WHERE email IN (
  'normsii@kai-pos.com',
  '24kai@kai-pos.com'
);

-- Verify the business owners were created
SELECT id, email, full_name, is_platform_admin, created_at
FROM public.users
WHERE email IN (
  'normsii@kai-pos.com',
  '24kai@kai-pos.com'
)
ORDER BY created_at DESC;
