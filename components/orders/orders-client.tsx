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
import { Button } from "@/components/ui/button";
import { Trash2, X, Edit } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [cancelDialog, setCancelDialog] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
        .select("*, order_items(*), payments(*), tables(label)")
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

  async function cancelOrder(order: Order) {
    setCancelling(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id);

    setCancelling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Order #${order.order_number} cancelled`);
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "cancelled" } : o));
    setCancelDialog(null);
  }

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
              {(role === "cashier" || role === "owner" || role === "manager") && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={(role === "cashier" || role === "owner" || role === "manager") ? 7 : 6}
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
                      {o.tables?.label ? (
                        <span className="text-xs text-muted-foreground">
                          Table {o.tables.label}
                        </span>
                      ) : null}
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
                  {(role === "cashier" || role === "owner" || role === "manager") && (
                    <TableCell className="text-right">
                      {o.status !== "cancelled" && o.status !== "paid" && o.status !== "served" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          onClick={() => setCancelDialog(o)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!cancelDialog} onOpenChange={(o) => !o && setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel Order #{cancelDialog?.order_number}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)} disabled={cancelling}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelDialog && cancelOrder(cancelDialog)}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling..." : "Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
