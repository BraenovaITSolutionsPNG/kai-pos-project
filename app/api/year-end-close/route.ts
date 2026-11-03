/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/queries";

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (ctx.staff.role !== "owner") {
      return NextResponse.json({ error: "Only owners can perform year-end close" }, { status: 403 });
    }

    const body = await request.json();
    const { fiscalYear, confirm } = body;

    if (!confirm || confirm !== "CLOSE_YEAR") {
      return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
    }

    const supabase = await createClient();
    const restaurantId = ctx.restaurant.id;
    const year = fiscalYear || new Date().getFullYear();

    // 1. Fetch all transactional data for this restaurant
    const [ordersRes, expensesRes, shiftsRes, cashupsRes, invTxRes] = await Promise.all([
      supabase.from("orders").select("*, order_items(*), payments(*)").eq("restaurant_id", restaurantId),
      supabase.from("expenses").select("*").eq("restaurant_id", restaurantId),
      supabase.from("shifts").select("*").eq("restaurant_id", restaurantId),
      supabase.from("cashups").select("*").eq("restaurant_id", restaurantId),
      supabase.from("inventory_transactions").select("*").eq("restaurant_id", restaurantId),
    ]);

    const orders = ordersRes.data || [];
    const expenses = expensesRes.data || [];
    const shifts = shiftsRes.data || [];
    const cashups = cashupsRes.data || [];
    const invTx = invTxRes.data || [];

    // 2. Build backup JSON
    const backup = {
      fiscal_year: year,
      restaurant_id: restaurantId,
      restaurant_name: ctx.restaurant.name,
      closed_at: new Date().toISOString(),
      closed_by: ctx.user.email,
      orders,
      expenses,
      shifts,
      cashups,
      inventory_transactions: invTx,
    };

    // 3. Archive data (insert into archive tables)
    if (orders.length > 0) {
      const orderRows = orders.map((o: any) => ({ ...o, fiscal_year: year }));
      const orderItemRows = orders.flatMap((o: any) =>
        (o.order_items || []).map((oi: any) => ({ ...oi, fiscal_year: year }))
      );
      const paymentRows = orders.flatMap((o: any) =>
        (o.payments || []).map((p: any) => ({ ...p, fiscal_year: year }))
      );

      await supabase.from("orders_archive").insert(orderRows.map((o: any) => {
        const { order_items, payments, ...rest } = o;
        return rest;
      }));
      if (orderItemRows.length > 0) {
        await supabase.from("order_items_archive").insert(orderItemRows);
      }
      if (paymentRows.length > 0) {
        await supabase.from("payments_archive").insert(paymentRows);
      }
    }

    if (expenses.length > 0) {
      await supabase.from("expenses_archive").insert(expenses.map((e: any) => ({ ...e, fiscal_year: year })));
    }
    if (shifts.length > 0) {
      await supabase.from("shifts_archive").insert(shifts.map((s: any) => ({ ...s, fiscal_year: year })));
    }
    if (cashups.length > 0) {
      await supabase.from("cashups_archive").insert(cashups.map((c: any) => ({ ...c, fiscal_year: year })));
    }
    if (invTx.length > 0) {
      await supabase.from("inventory_transactions_archive").insert(invTx.map((t: any) => ({ ...t, fiscal_year: year })));
    }

    // 4. Delete transactional data (keep products, categories, settings, staff, tables)
    await Promise.all([
      supabase.from("order_items").delete().in("order_id", orders.map((o: any) => o.id)),
      supabase.from("payments").delete().in("order_id", orders.map((o: any) => o.id)),
    ]);
    await supabase.from("orders").delete().eq("restaurant_id", restaurantId);
    await supabase.from("expenses").delete().eq("restaurant_id", restaurantId);
    await supabase.from("shifts").delete().eq("restaurant_id", restaurantId);
    await supabase.from("cashups").delete().eq("restaurant_id", restaurantId);
    await supabase.from("inventory_transactions").delete().eq("restaurant_id", restaurantId);

    // Reset inventory stock to 0 (or keep current - user choice)
    await supabase.from("ingredients").update({ current_stock: 0 }).eq("restaurant_id", restaurantId);

    return NextResponse.json({
      success: true,
      backup,
      summary: {
        orders_archived: orders.length,
        expenses_archived: expenses.length,
        shifts_archived: shifts.length,
        cashups_archived: cashups.length,
        inventory_transactions_archived: invTx.length,
      },
    });
  } catch (error) {
    console.error("Year-end close error:", error);
    return NextResponse.json({ error: "Failed to perform year-end close" }, { status: 500 });
  }
}

