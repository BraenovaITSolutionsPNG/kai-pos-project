import type { Order } from "@/lib/types";

export interface DashboardStats {
  todaySales: number;
  ordersToday: number;
  avgOrderValue: number;
  bestSeller: { name: string; qty: number } | null;
  salesTrend: { date: string; total: number }[];
  ordersByDay: { date: string; count: number }[];
  topProducts: { name: string; qty: number }[];
  paymentSplit: { method: string; amount: number }[];
}

interface OrderItemRow {
  product_name: string;
  quantity: number;
}

interface PaymentRow {
  method: string;
  amount: number;
}

export function computeDashboardStats(orders: Order[]): DashboardStats {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  // An order is paid at the POS when it is created (a payment row is
  // inserted), while its status tracks kitchen fulfilment (open → served).
  // Count any non-cancelled order that actually has a payment record.
  const paid = orders.filter(
    (o) => o.status !== "cancelled" && (o.payments?.length ?? 0) > 0
  );

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todays = paid.filter((o) => new Date(o.created_at) >= todayStart);

  const todaySales = todays.reduce((sum, o) => sum + Number(o.total), 0);
  const ordersToday = todays.length;
  const allSales = paid.reduce((sum, o) => sum + Number(o.total), 0);
  const avgOrderValue = paid.length ? allSales / paid.length : 0;

  const productMap = new Map<string, { name: string; qty: number }>();
  for (const o of paid) {
    for (const it of (o.order_items ?? []) as unknown as OrderItemRow[]) {
      const cur = productMap.get(it.product_name);
      if (cur) cur.qty += it.quantity;
      else
        productMap.set(it.product_name, {
          name: it.product_name,
          qty: it.quantity,
        });
    }
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty);
  const bestSeller = topProducts[0] ?? null;

  const salesTrend = new Map<string, number>();
  const ordersByDay = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    salesTrend.set(key, 0);
    ordersByDay.set(key, 0);
  }
  for (const o of paid) {
    const key = o.created_at.slice(0, 10);
    if (salesTrend.has(key))
      salesTrend.set(key, salesTrend.get(key)! + Number(o.total));
    if (ordersByDay.has(key)) ordersByDay.set(key, ordersByDay.get(key)! + 1);
  }

  const splitMap = new Map<string, number>();
  for (const o of paid) {
    for (const p of (o.payments ?? []) as unknown as PaymentRow[]) {
      splitMap.set(p.method, (splitMap.get(p.method) ?? 0) + Number(p.amount));
    }
  }

  return {
    todaySales,
    ordersToday,
    avgOrderValue,
    bestSeller,
    salesTrend: [...salesTrend.entries()].map(([date, total]) => ({ date, total })),
    ordersByDay: [...ordersByDay.entries()].map(([date, count]) => ({
      date,
      count,
    })),
    topProducts,
    paymentSplit: [...splitMap.entries()].map(([method, amount]) => ({
      method,
      amount,
    })),
  };
}
