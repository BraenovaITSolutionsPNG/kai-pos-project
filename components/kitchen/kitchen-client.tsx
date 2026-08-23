"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ColumnId = "new" | "preparing" | "ready";

const POLL_MS = 8000;

function itemStage(item: OrderItem): ColumnId {
  return item.status;
}

function orderColumn(order: Order): ColumnId {
  const items = order.order_items ?? [];
  if (items.length === 0) return "new";
  const stages = items.map(itemStage);
  if (stages.every((s) => s === "ready")) return "ready";
  if (stages.some((s) => s === "preparing")) return "preparing";
  return "new";
}

const columnMeta: Record<ColumnId, { title: string; card: string; text: string }> = {
  new: {
    title: "New",
    card: "border-l-amber-400 bg-card",
    text: "text-amber-600",
  },
  preparing: {
    title: "Preparing",
    card: "border-l-sky-500 bg-card",
    text: "text-sky-600",
  },
  ready: {
    title: "Ready",
    card: "border-l-green-500 bg-card",
    text: "text-green-600",
  },
};

function OrderCard({
  order,
  busy,
  onAdvance,
}: {
  order: Order;
  busy: boolean;
  onAdvance: (action: "preparing" | "ready" | "served") => void;
}) {
  const stage = orderColumn(order);
  const items = order.order_items ?? [];
  const hasNew = items.some((i) => i.status === "new");
  const hasPreparing = items.some((i) => i.status === "preparing");
  const allReady = stage === "ready";

  return (
    <div className={cn("rounded-xl border border-l-4 shadow-sm", columnMeta[stage].card)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <p className="font-heading text-base font-semibold">
            Order #{order.order_number}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatTime(order.created_at)}
            {order.order_items?.length ? ` · ${order.order_items.length} items` : ""}
          </p>
        </div>
        <Badge variant="outline" className={columnMeta[stage].text}>
          {columnMeta[stage].title}
        </Badge>
      </div>
      <div className="space-y-1.5 px-3 py-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">{it.quantity}×</span> {it.product_name}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0",
                it.status === "new" && "text-amber-600",
                it.status === "preparing" && "text-sky-600",
                it.status === "ready" && "text-green-600"
              )}
            >
              {it.status}
            </Badge>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t px-3 py-2">
        {!allReady && (
          <Button
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => onAdvance(hasNew && !hasPreparing ? "preparing" : "ready")}
          >
            {hasNew && !hasPreparing ? "Start cooking" : "Mark ready"}
          </Button>
        )}
        {allReady && (
          <Button
            size="sm"
            className="flex-1"
            variant="outline"
            disabled={busy}
            onClick={() => onAdvance("served")}
          >
            Mark served
          </Button>
        )}
      </div>
    </div>
  );
}

export function KitchenClient({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRef = useRef<() => void>(() => {});

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*), payments(*)")
      .in("status", ["open", "sent_to_kitchen", "preparing", "ready", "paid"]);
    if (data) setOrders(data as unknown as Order[]);
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await load();
      scheduleRef.current?.();
    }, POLL_MS);
  }, [load]);

  // Initialize scheduleRef after schedule is defined
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  useEffect(() => {
    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [schedule]);

  async function advance(order: Order, action: "preparing" | "ready" | "served") {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("advance_kitchen", {
      order_id: order.id,
      action,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      action === "served"
        ? `Order #${order.order_number} served`
        : `Order #${order.order_number} → ${action}`
    );
    router.refresh();
    await load();
  }

  const columns: ColumnId[] = ["new", "preparing", "ready"];
  const counts: Record<ColumnId, number> = {
    new: orders.filter((o) => orderColumn(o) === "new").length,
    preparing: orders.filter((o) => orderColumn(o) === "preparing").length,
    ready: orders.filter((o) => orderColumn(o) === "ready").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Kitchen Display
          </h1>
          <p className="text-sm text-muted-foreground">
            Live order pipeline, refreshes automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <ChefHat />
          Refresh now
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map((col) => (
          <div
            key={col}
            className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-3"
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wide">
                {columnMeta[col].title}
              </h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {counts[col]}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {orders
                .filter((o) => orderColumn(o) === col)
                .map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    busy={busy}
                    onAdvance={(a) => void advance(o, a)}
                  />
                ))}
              {counts[col] === 0 && (
                <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No orders
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}