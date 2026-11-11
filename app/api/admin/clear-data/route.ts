import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSqliteMode, isMySqlMode } from "@/lib/supabase/env";

export async function POST() {
  try {
    // 1. Authenticate user from session cookies using server client
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated. Please sign in as a platform admin." },
        { status: 401 }
      );
    }

    // Verify platform admin status
    const { data: profile } = await serverClient
      .from("users")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_platform_admin) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Platform admin privileges required." },
        { status: 403 }
      );
    }

    // 2. Handle SQLite mode (local development)
    if (isSqliteMode()) {
      const { getDb } = await import("@/lib/sqlite/pool");
      const db = getDb();
      const tables = [
        "order_items",
        "payments",
        "orders",
        "cashups",
        "expenses",
        "inventory_transactions",
        "notifications",
        "order_counters",
        "subscription_payments",
        "customers",
        "shifts",
        "shift_schedules",
        "recipes",
        "ingredients",
        "products",
        "categories",
        "tables",
        "restaurants",
        "staff",
        "businesses",
      ];

      db.transaction(() => {
        for (const table of tables) {
          try {
            db.prepare(`DELETE FROM ${table}`).run();
          } catch {
            // Table might not exist or already be empty
          }
        }
        db.prepare(
          "DELETE FROM users WHERE is_platform_admin != 1 OR is_platform_admin IS NULL"
        ).run();
        db.prepare(
          "DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users WHERE is_platform_admin = 1)"
        ).run();
      })();

      return NextResponse.json({
        ok: true,
        cleared: tables.length,
        message: "All test data cleared in SQLite database.",
      });
    }

    // 3. Handle MySQL mode
    if (isMySqlMode()) {
      const { query } = await import("@/lib/mysql/pool");
      const tables = [
        "order_items",
        "payments",
        "orders",
        "cashups",
        "expenses",
        "inventory_transactions",
        "notifications",
        "order_counters",
        "subscription_payments",
        "customers",
        "shifts",
        "shift_schedules",
        "recipes",
        "ingredients",
        "products",
        "categories",
        "tables",
        "restaurants",
        "staff",
        "businesses",
      ];

      for (const table of tables) {
        try {
          await query(`DELETE FROM ${table}`);
        } catch {
          // Table might not exist or already be empty
        }
      }
      await query("DELETE FROM users WHERE is_platform_admin != 1 OR is_platform_admin IS NULL");

      return NextResponse.json({
        ok: true,
        cleared: tables.length,
        message: "All test data cleared in MySQL database.",
      });
    }

    // 4. Handle Supabase mode (production on Vercel)
    // First, try executing the RPC function `clear_platform_test_data` using the user's authenticated session.
    // This allows clearing test data using only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
    const { data: rpcData, error: rpcError } = await serverClient.rpc("clear_platform_test_data");

    if (!rpcError) {
      return NextResponse.json({
        ok: true,
        message:
          typeof rpcData === "object" && rpcData?.message
            ? rpcData.message
            : "Successfully reset all test data via Supabase RPC.",
      });
    }

    console.error("[clear-data] Supabase RPC error:", rpcError);

    // If RPC is not created yet or failed, fall back to SUPABASE_SERVICE_ROLE_KEY if present
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceUrl || !serviceKey) {
      return NextResponse.json(
        {
          ok: false,
          error: `Supabase RPC error: ${rpcError.message}${
            rpcError.details ? ` (${rpcError.details})` : ""
          }. Tip: If you just added the function in the SQL editor, run "NOTIFY pgrst, 'reload schema';" in Supabase to refresh the cache.`,
        },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(serviceUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const tables = [
      "order_items",
      "payments",
      "orders",
      "cashups",
      "expenses",
      "inventory_transactions",
      "notifications",
      "order_counters",
      "subscription_payments",
      "customers",
      "shifts",
      "shift_schedules",
      "recipes",
      "ingredients",
      "products",
      "categories",
      "tables",
      "reservations",
      "restaurants",
      "staff",
      "businesses",
    ];

    for (const table of tables) {
      const filterCol = table === "order_counters" ? "restaurant_id" : "id";
      const { error } = await adminClient
        .from(table)
        .delete()
        .neq(filterCol, "00000000-0000-0000-0000-000000000000");

      if (error) {
        console.warn(`[clear-data] Non-fatal error clearing ${table}:`, error.message);
      }
    }

    // Preserve platform admins; delete all non-admin users
    const { data: adminUsers } = await adminClient
      .from("users")
      .select("id, email")
      .eq("is_platform_admin", true);

    const adminUserIds = new Set((adminUsers ?? []).map((u: { id: string }) => u.id));

    const { data: allUsers } = await adminClient.from("users").select("id");
    const nonAdminIds = (allUsers ?? [])
      .map((u: { id: string }) => u.id)
      .filter((id: string) => !adminUserIds.has(id));

    for (const nonAdminId of nonAdminIds) {
      await adminClient.auth.admin.deleteUser(nonAdminId).catch((err: unknown) => {
        console.warn(`[clear-data] Failed to delete auth user ${nonAdminId}:`, err);
      });
    }

    for (const nonAdminId of nonAdminIds) {
      await adminClient.from("users").delete().eq("id", nonAdminId);
    }

    return NextResponse.json({
      ok: true,
      cleared: tables.length,
      nonAdminUsersRemoved: nonAdminIds.length,
      adminUsersKept: (adminUsers ?? []).length,
      message: "Successfully reset all test data while preserving platform admin accounts.",
    });
  } catch (error) {
    console.error("[clear-data] Error resetting data:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
