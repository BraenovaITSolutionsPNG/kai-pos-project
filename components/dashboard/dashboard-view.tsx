"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign, ReceiptText, TrendingUp, Trophy } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { OrdersBarChart } from "@/components/dashboard/orders-bar-chart";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/supabase/env";
import {
  computeDashboardStats,
  type DashboardStats,
} from "@/lib/stats";
import { formatKina, paymentMethodLabel } from "@/lib/format";
import type { Order, PaymentMethod } from "@/lib/types";

export function DashboardView({
  initialStats,
}: {
  initialStats: DashboardStats;
}) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);

  // In demo mode the browser holds the live data (including orders rung up
  // this session), so recompute locally instead of trusting server seed data.
  useEffect(() => {
    if (!isDemoMode()) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: orders } = await supabase
        .from("orders")
        .select("*, order_items(*), payments(*)")
        .order("created_at", { ascending: false });
      if (!cancelled && orders) {
        setStats(computeDashboardStats(orders as unknown as Order[]));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxTop = Math.max(1, ...stats.topProducts.slice(0, 5).map((p) => p.qty));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Sales overview across the last 7 days.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today's Sales"
          value={formatKina(stats.todaySales)}
          subtitle={`${stats.ordersToday} paid order${stats.ordersToday === 1 ? "" : "s"} today`}
          icon={CircleDollarSign}
        />
        <StatCard
          title="Orders (7 days)"
          value={String(
            stats.ordersByDay.reduce((sum, d) => sum + d.count, 0)
          )}
          subtitle="All paid orders this week"
          icon={ReceiptText}
        />
        <StatCard
          title="Avg Order Value"
          value={formatKina(stats.avgOrderValue)}
          subtitle="Across paid orders (7 days)"
          icon={TrendingUp}
        />
        <StatCard
          title="Best Seller"
          value={stats.bestSeller?.name ?? "No sales yet"}
          subtitle={
            stats.bestSeller
              ? `${stats.bestSeller.qty} × sold`
              : "No sales yet"
          }
          icon={Trophy}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales trend</CardTitle>
            <CardDescription>Total sales per day (Kina)</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesTrendChart data={stats.salesTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Orders by day</CardTitle>
            <CardDescription>Number of paid orders per day</CardDescription>
          </CardHeader>
          <CardContent>
            <OrdersBarChart data={stats.ordersByDay} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>Most-sold items in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sales recorded yet. Ring up your first order on the POS.
              </p>
            ) : (
              stats.topProducts.slice(0, 5).map((p) => (
                <div key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">
                      {p.qty} sold
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(p.qty / maxTop) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>Value settled by method (7 days)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.paymentSplit.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            ) : (
              stats.paymentSplit.map((p) => (
                <div
                  key={p.method}
                  className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {paymentMethodLabel(p.method as PaymentMethod)}
                  </span>
                  <span>{formatKina(p.amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
