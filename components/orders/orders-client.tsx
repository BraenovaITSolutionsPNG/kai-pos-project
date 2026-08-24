"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/supabase/env";
import { OrdersFilter } from "@/components/orders/orders-filter";
import { formatDateTime, formatKina, paymentMethodLabel } from "@/lib/format";
import type { Order, PaymentMethod, StaffRole } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const statusLabel: Record<string, string> = {
  open: "Open",
  sent_to_kitchen: "Sent to kitchen",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  paid: "Paid",
  cancelled: "Cancelled",
};

const orderTypeLabel: Record<string, string> = {
  dine_in: "Dine in",
  takeaway: "Takeaway",
};

export function OrdersClient({
  initialOrders,
  from,
  to,
  role,
}: {
  initialOrders: Order[];
  from: string;
  to: string;
  role: StaffRole;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // Waiters only see orders that are ready to serve / pick up.
  const visibleOrders =
    role === "waiter"
      ? orders.filter((o) => o.status === "ready")
      : orders;

  // In demo mode the browser holds the live data (including orders rung up
  // this session), so reload from it instead of trusting server seed data.
  useEffect(() => {
    if (!isDemoMode()) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      let query = supabase
        .from("orders")
        .select("*, order_items(*), payments(*)")
        .order("created_at", { ascending: false });
      if (from) query = query.gte("created_at", `${from}T00:00:00`);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);
      const { data } = await query;
      if (!cancelled && data) {
        setOrders(data as unknown as Order[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const totalSales = visibleOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Orders
        </h1>
        <p className="text-sm text-muted-foreground">
          {visibleOrders.length} order{visibleOrders.length === 1 ? "" : "s"} ·{" "}
          {formatKina(totalSales)} total
          {role === "waiter" && " · ready to serve / pick up"}
        </p>
      </div>

      <OrdersFilter from={from} to={to} />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  {role === "waiter"
                    ? "No orders are ready yet."
                    : "No orders in this period yet."}
                </TableCell>
              </TableRow>
            ) : (
              visibleOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>#{o.order_number}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {orderTypeLabel[o.order_type] ?? o.order_type}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(o.created_at)}</TableCell>
                  <TableCell className="max-w-64 truncate">
                    {(o.order_items ?? [])
                      .map((i) => `${i.quantity}× ${i.product_name}`)
                      .join(", ")}
                  </TableCell>
                  <TableCell>
                    {paymentMethodLabel(
                      (o.payments?.[0]?.method ?? "cash") as PaymentMethod
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={o.status === "cancelled" ? "destructive" : "secondary"}
                    >
                      {statusLabel[o.status] ?? o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatKina(Number(o.total))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
