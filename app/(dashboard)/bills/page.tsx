import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { BillsClient } from "@/components/menu/bills-client";

export default async function BillsPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/bills");

  const supabase = await createClient();

  // Fetch tables for labels
  const { data: tablesData } = await supabase
    .from("tables")
    .select("id, label")
    .eq("restaurant_id", ctx.restaurant.id);
  const tableLabels = new Map((tablesData ?? []).map(t => [t.id, t.label]));

  // Fetch open self-service dine-in orders grouped by table
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      subtotal,
      tax,
      total,
      table_id,
      created_at,
      order_items (
        id,
        product_name,
        quantity,
        unit_price,
        notes
      )
    `)
    .eq("restaurant_id", ctx.restaurant.id)
      .eq("source", "self_service")
      .eq("order_type", "dine_in")
      .in("status", ["open", "sent_to_kitchen", "preparing", "ready", "served"])
      .order("created_at", { ascending: true });

  if (error) {
    console.error("Bills fetch error:", error);
  }

  // Group by table
  const tableMap = new Map<string, { label: string; orders: any[]; total: number }>();
  orders?.forEach((order) => {
    const tableId = order.table_id ?? "unknown";
    const tableLabel = tableLabels.get(tableId) ?? `Table ${tableId.slice(0, 8)}`;
    if (!tableMap.has(tableId)) {
      tableMap.set(tableId, { label: tableLabel, orders: [], total: 0 });
    }
    const entry = tableMap.get(tableId)!;
    entry.orders.push(order);
    entry.total += Number(order.total);
  });

  const tableBills = Array.from(tableMap.entries()).map(([tableId, data]) => ({
    tableId,
    ...data,
  }));

  return <BillsClient tableBills={tableBills} restaurantId={ctx.restaurant.id} />;
}