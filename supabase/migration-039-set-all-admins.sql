-- Set all existing users as platform admin for testing
-- (Remove this in production and set only the real admin)
update public.users set is_platform_admin = true;
