"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Trash2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime, formatKina, paymentMethodLabel } from "@/lib/format";
import type { Expense, Order, PaymentMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type RangeKey = "today" | "7d" | "30d" | "month";

const PAYMENT_COLORS: Record<string, string> = {
  cash: "#22c55e",
  eftpos: "#3b82f6",
  bank_transfer: "#8b5cf6",
  bsp: "#f59e0b",
  kina_bank: "#06b6d4",
  anz: "#6366f1",
  westpac: "#ec4899",
  other: "#94a3b8",
};

function rangeBounds(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const start = new Date(now);
  if (key === "today") start.setHours(0, 0, 0, 0);
  else if (key === "7d") start.setDate(start.getDate() - 6);
  else if (key === "30d") start.setDate(start.getDate() - 29);
  else if (key === "month") start.setDate(1);
  return { from: start.toISOString().slice(0, 10), to };
}

function computeStats(orders: Order[], expenses: Expense[]) {
  const paid = orders.filter((o) => o.status === "paid");
  const gross = paid.reduce((s, o) => s + Number(o.total), 0);
  const sales = paid.reduce((s, o) => s + Number(o.subtotal), 0);
  const tax = paid.reduce((s, o) => s + Number(o.tax), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const byDay = new Map<string, number>();
  for (const o of paid) {
    const key = o.created_at.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(o.total));
  }
  const trend = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, total]) => ({ date, total }));

  const productMap = new Map<string, { qty: number; amount: number }>();
  for (const o of paid) {
    for (const it of o.order_items ?? []) {
      const cur = productMap.get(it.product_name) ?? { qty: 0, amount: 0 };
      cur.qty += it.quantity;
      cur.amount += it.quantity * Number(it.unit_price);
      productMap.set(it.product_name, cur);
    }
  }
  const topProducts = [...productMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const payMap = new Map<string, number>();
  for (const o of paid) {
    for (const p of o.payments ?? []) {
      payMap.set(p.method, (payMap.get(p.method) ?? 0) + Number(p.amount));
    }
  }
  const paymentSplit = [...payMap.entries()].map(([method, amount]) => ({
    method,
    amount,
  }));

  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  const expenseSplit = [...byCategory.entries()].map(([category, amount]) => ({
    category,
    amount,
  }));

  return {
    gross,
    sales,
    tax,
    totalExpenses,
    net: gross - totalExpenses,
    orderCount: paid.length,
    avgOrder: paid.length ? gross / paid.length : 0,
    trend,
    topProducts,
    paymentSplit,
    expenseSplit,
  };
}

function ExpenseDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState("Supplies");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !amount || Number(amount) <= 0) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("expenses")
      .insert({ category, amount: Number(amount), note: note.trim() || null });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense recorded");
    router.refresh();
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
          <DialogDescription>
            Log an outgoing cost for this period.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exp-cat">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "Supplies")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Supplies", "Staff", "Rent", "Utilities", "Marketing", "Maintenance", "Other"].map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-amt">Amount (Kina)</Label>
            <Input
              id="exp-amt"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50.00"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-note">Note</Label>
            <Input
              id="exp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Napkins"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReportsClient() {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>("today");
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [addExpense, setAddExpense] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const load = useCallback(async (key: RangeKey) => {
    setLoading(true);
    const { from, to } = rangeBounds(key);
    const supabase = createClient();
    const [ordersRes, expRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*), payments(*)")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`),
      supabase
        .from("expenses")
        .select("*")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data as unknown as Order[]);
    if (expRes.data) setExpenses(expRes.data as unknown as Expense[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  const stats = computeStats(orders, expenses);

  async function confirmDeleteExpense() {
    if (!deleting) return;
    const supabase = createClient();
    const { error } = await supabase.from("expenses").delete().eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense deleted");
    setDeleting(null);
    router.refresh();
    await load(range);
  }

  function exportCsv() {
    const rows = orders.map((o) => ({
      Order: o.order_number,
      Date: o.created_at,
      Status: o.status,
      Subtotal: Number(o.subtotal).toFixed(2),
      Tax: Number(o.tax).toFixed(2),
      Total: Number(o.total).toFixed(2),
      Payment: (o.payments?.[0]?.method ?? "").replace("_", " "),
    }));
    const header = Object.keys(rows[0] ?? {}).join(",");
    const csv = [header, ...rows.map((r) => Object.values(r).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kai-sales-${rangeBounds(range).from}-to-${rangeBounds(range).to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: "Gross sales", value: formatKina(stats.gross) },
    { label: "Orders", value: String(stats.orderCount) },
    { label: "Avg order", value: formatKina(stats.avgOrder) },
    { label: "Tax collected", value: formatKina(stats.tax) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Sales performance and expenses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={range}
            onValueChange={(v) => setRange((v ?? "today") as RangeKey)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}>
            <Download />
            Export CSV
          </Button>
          <Button onClick={() => setAddExpense(true)}>
            <Plus />
            Add expense
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="mt-1 font-heading text-2xl font-semibold">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-heading text-sm font-semibold">Sales by day</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.trend} margin={{ left: 8, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `K${v}`}
                      width={52}
                    />
                    <Tooltip
                      formatter={(value) => formatKina(Number(value))}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-heading text-sm font-semibold">Payment methods</h2>
              <div className="flex h-56 items-center">
                <div className="h-full flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.paymentSplit}
                        dataKey="amount"
                        nameKey="method"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {stats.paymentSplit.map((p) => (
                          <Cell
                            key={p.method}
                            fill={PAYMENT_COLORS[p.method] ?? "#94a3b8"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatKina(Number(value))}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex w-40 flex-col gap-1.5">
                  {stats.paymentSplit.map((p) => (
                    <div key={p.method} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: PAYMENT_COLORS[p.method] ?? "#94a3b8" }}
                        />
                        {paymentMethodLabel(p.method as PaymentMethod)}
                      </span>
                      <span className="font-medium">{formatKina(p.amount)}</span>
                    </div>
                  ))}
                  {stats.paymentSplit.length === 0 && (
                    <p className="text-sm text-muted-foreground">No payments.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-heading text-sm font-semibold">Top products</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        No sales in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.topProducts.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right">{formatKina(p.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-sm font-semibold">Expenses</h2>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-heading font-semibold">{formatKina(stats.totalExpenses)}</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Del</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        No expenses recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(e.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">{e.category}</TableCell>
                        <TableCell className="text-muted-foreground">{e.note ?? ""}</TableCell>
                        <TableCell className="text-right">{formatKina(e.amount)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(e)}>
                            <Trash2 />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 rounded-xl border bg-card p-4">
            <div>
              <p className="text-sm text-muted-foreground">Gross sales</p>
              <p className="mt-1 font-heading text-xl font-semibold">{formatKina(stats.gross)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="mt-1 font-heading text-xl font-semibold">{formatKina(stats.totalExpenses)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net ({formatDate(rangeBounds(range).from)} → {formatDate(rangeBounds(range).to)})</p>
              <p className="mt-1 font-heading text-xl font-semibold">{formatKina(stats.net)}</p>
            </div>
          </div>
        </>
      )}

      {addExpense && (
        <ExpenseDialog
          onClose={() => setAddExpense(false)}
          onDone={() => {
            setAddExpense(false);
            void load(range);
          }}
        />
      )}

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
            <DialogDescription>
              {deleting?.category} {deleting ? formatKina(deleting.amount) : ""} will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteExpense}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}