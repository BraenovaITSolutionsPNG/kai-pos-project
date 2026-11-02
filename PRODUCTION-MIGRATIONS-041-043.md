# KAI POS production database rollout: migrations 041–043

This guide applies the keyed site-content fix (041), admin/reservations access controls (042), and POS/table-settlement tenant checks (043). The companion [transactional SQL script](supabase/production-rollout-041-043.sql) contains preflight checks, all three migrations, postflight assertions, and read-only confirmation queries. It does not change `is_platform_admin` values and does not deploy the web app.

## Before production

1. **Test in staging first.** Use a separate Supabase staging project and staging app environment. Do not point preview deployments at the production database.
2. **Take a restorable backup or snapshot** and confirm you know how to restore it. Schedule the change for a low-traffic period.
3. **Confirm the target project.** In Supabase, check the project name/ref before opening SQL Editor. The script prints the current platform-admin list before applying changes; verify it contains only the expected administrators (you previously reported `admin@kaipos.com`).
4. **Check prerequisites.** Migration 041 requires `public.site_content` with a unique key. Migration 042 requires `public.reservations`, `public.user_restaurant_ids()`, and `public.assert_platform_admin()`. Migration 043 also requires the POS, product, table, payment, and order columns listed in the script's preflight block. If preflight reports a missing dependency, stop and reconcile the database; do not bypass the check.

## Apply in staging, then production

5. Open the target project's **SQL Editor**, select the correct project, and run the entire `supabase/production-rollout-041-043.sql` file once as a single execution. It wraps migrations 041, 042, and 043 in one transaction, uses a short lock timeout, and checks grants and reservation policies before committing. A failure before `COMMIT` aborts the rollout; read the error and resolve it before retrying.

   Alternatively, from a trusted terminal with a database connection string kept out of chat and Git, run:

   ```bash
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/production-rollout-041-043.sql
   ```

6. Review the postflight results. Confirm the expected admin list, all four tenant-scoped reservation policies, public read access for site content, and denial of anonymous execution for admin, order-creation, and settlement RPCs. Then test with two staff accounts from different restaurants: normal POS creation and settlement should succeed within a member’s own restaurant; cross-restaurant attempts should be denied.
7. Repeat the same procedure against production only after staging passes. If the script fails, do not mark the migrations applied or rerun blindly. The transaction should roll back before commit. After a successful commit, use a tested forward fix or restore the backup rather than assuming the transaction can be undone.

## Important deployment note

This repository currently stores numbered files as `supabase/migration-041-...sql`, not in Supabase CLI’s standard `supabase/migrations/<timestamp>_name.sql` directory. The companion SQL script can be run in SQL Editor or with `psql`, but it does **not** register these files in Supabase CLI migration history or create automatic database deployment. Before using `supabase db push` or CI for database changes, reconcile the existing production schema/history and move to a consistent versioned migration workflow. Supabase recommends testing migrations locally and keeping remote changes represented in migration files.[1] The Git-based web-app deployment is separate from database migrations.[2]

## References

[1]: https://supabase.com/docs/guides/local-development/database-migrations "Supabase local database migration workflow"
[2]: https://supabase.com/docs/guides/deployment/database-migrations "Supabase database migration deployment guide"
