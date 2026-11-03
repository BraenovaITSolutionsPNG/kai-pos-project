import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 500 },
    );
  }

  const supabase = createClient(serviceUrl, serviceKey);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return NextResponse.json({ ok: false, error: "Not a platform admin" }, { status: 403 });
  }

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
    "site_content",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      return NextResponse.json({ ok: false, error: `Failed to clear ${table}: ${error.message}` }, { status: 500 });
    }
  }

  const { data: nonAdminUsers } = await supabase.from("users").select("id").neq("is_platform_admin", true);
  const nonAdminIds = (nonAdminUsers ?? []).map((u: any) => u.id);

  for (const nonAdminId of nonAdminIds) {
    await supabase.auth.admin.deleteUser(nonAdminId).catch(() => {});
  }

  await supabase.from("users").delete().neq("is_platform_admin", true);

  const { data: adminUsers } = await supabase.from("users").select("id").eq("is_platform_admin", true);

  return NextResponse.json({
    ok: true,
    cleared: tables.length,
    nonAdminUsersRemoved: nonAdminIds.length,
    adminUsersKept: (adminUsers ?? []).length,
  });
}
