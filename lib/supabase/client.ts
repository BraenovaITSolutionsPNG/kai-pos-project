import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMySqlMode, isSqliteMode } from "@/lib/supabase/env";
import { createMysqlBrowserClient } from "@/lib/mysql/browser-client";
import { createSqliteBrowserClient } from "@/lib/sqlite/browser-client";

export function createClient(): SupabaseClient {
  if (isSqliteMode()) {
    return createSqliteBrowserClient() as unknown as SupabaseClient;
  }
  if (isMySqlMode()) {
    return createMysqlBrowserClient() as unknown as SupabaseClient;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
