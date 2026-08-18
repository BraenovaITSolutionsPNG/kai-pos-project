import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemoMode, isMySqlMode } from "@/lib/supabase/env";
import { createDemoClient } from "@/lib/supabase/demo-client";
import { createMysqlBrowserClient } from "@/lib/mysql/browser-client";

export function createClient(): SupabaseClient {
  if (isMySqlMode()) {
    return createMysqlBrowserClient() as unknown as SupabaseClient;
  }
  if (isDemoMode()) {
    return createDemoClient() as unknown as SupabaseClient;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}