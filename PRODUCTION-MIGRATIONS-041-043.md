# KAI POS production database rollout: migration 030 and migrations 041–043

The companion [transactional SQL script](supabase/production-rollout-041-043.sql) now includes migration 030, followed by 041, 042, and 043 in a single transaction. Migration 030 creates the missing reservations table and starts with broad authenticated policies; migration 042 replaces those policies with tenant-scoped rules **before the transaction commits**. Do not run migration 030 by itself against production. This rollout does not change `is_platform_admin` values and does not deploy the web app.

## Before production

1. **Test in staging first.** Use a separate Supabase staging project and staging app environment. Do not point preview deployments at the production database.
2. **Take a restorable backup or snapshot** and confirm you know how to restore it. Choose a low-traffic window.
3. **Confirm the target project.** Verify the Supabase project name/ref before opening SQL Editor. The script prints the current platform-admin list; confirm it contains only the administrators you expect (you previously reported `admin@kaipos.com`).
4. **Check base prerequisites.** The script expects `public.site_content` with a unique key, `public.user_restaurant_ids()`, `public.assert_platform_admin()`, Supabase roles and auth helpers, and the POS/order schema columns listed in its preflight block. It creates `public.reservations` if absent. If preflight reports any other missing dependency—or unexpected reservation policies—stop and reconcile the schema rather than bypassing the check.

## Apply in staging, then production

5. In the target project's **SQL Editor**, verify the project, then run the entire `supabase/production-rollout-041-043.sql` file once as a single execution. It creates/repairs the migration-030 reservation objects, applies 041–043, checks grants and tenant-scoped policies, then commits. It uses a short lock timeout. A failure aborts the transaction; inspect the error before retrying.

   Alternatively, from a trusted terminal with the connection string kept out of chat and Git:

   ```bash
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/production-rollout-041-043.sql
   ```

6. Review the result sets. Confirm the expected platform admins, all four tenant-scoped reservation policies, public site-content reads, and anonymous denial for admin, order-creation, and settlement RPCs. In staging, test POS creation and table settlement with staff accounts from two restaurants: same-tenant actions should succeed; cross-tenant attempts should be rejected.
7. Only after staging passes, repeat against production. If the script fails before commit, do not mark it applied or run migration 030 separately; resolve the cause and rerun the full bundle. After a successful commit, use a tested forward fix or restore the backup if rollback is needed.

## Migration-history note

The repository stores numbered files as `supabase/migration-041-...sql`, not in Supabase CLI's standard `supabase/migrations/<timestamp>_name.sql` directory. This bundled SQL is executable through SQL Editor or `psql`, but does **not** register migration history or configure automatic database deployment. Reconcile the production schema/history before adopting `supabase db push` or CI. Supabase recommends testing migrations locally and keeping remote changes represented in migration files.[1] Web-app deployment is separate from database migrations.[2]

## References

[1]: https://supabase.com/docs/guides/local-development/database-migrations "Supabase local database migration workflow"
[2]: https://supabase.com/docs/guides/deployment/database-migrations "Supabase database migration deployment guide"
