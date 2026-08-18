import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemoMode, isMySqlMode } from "@/lib/supabase/env";
import { createDemoServerClient } from "@/lib/supabase/demo-server";
import { createMysqlServerClient } from "@/lib/mysql/server-client";

export async function createClient(): Promise<SupabaseClient> {
  if (isMySqlMode()) {
    return createMysqlServerClient() as unknown as SupabaseClient;
  }
  if (isDemoMode()) {
    return (await createDemoServerClient()) as unknown as SupabaseClient;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; safe to ignore when
            // middleware / proxy is refreshing sessions.
          }
        },
      },
    }
  );
}