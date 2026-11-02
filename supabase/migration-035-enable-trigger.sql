-- Enable the trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- Manually create user profiles for existing auth users
INSERT INTO public.users (id, email, full_name, is_platform_admin, created_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email),
  COALESCE((raw_user_meta_data->>'is_platform_admin')::boolean, false),
  created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;
