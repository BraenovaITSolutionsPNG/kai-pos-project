"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime, formatKina, formatTime, paymentMethodLabel } from "@/lib/format";
import type { Order, Payment, Expense, Cashup, Shift } from "@/lib/types";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RangeKey = "today" | "7d" | "30d" | "month" | "custom";
type ExportType = "orders" | "payments" | "expenses" | "cashups" | "shifts";

interface ExportConfig {
  type: ExportType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const EXPORTS: ExportConfig[] = [
  {
    type: "orders",
    label: "Orders",
    description: "All orders with items, totals, and payment status",
    icon: FileSpreadsheet,
  },
  {
    type: "payments",
    label: "Payments",
    description: "Payment transactions with methods and amounts",
    icon: FileSpreadsheet,
  },
  {
    type: "expenses",
    label: "Expenses",
    description: "Recorded expenses by category and date",
    icon: FileSpreadsheet,
  },
  {
    type: "cashups",
    label: "Cashups",
    description: "Daily cashup summaries with variances",
    icon: FileSpreadsheet,
  },
  {
    type: "shifts",
    label: "Staff Shifts",
    description: "Clock in/out records with durations",
    icon: FileSpreadsheet,
  },
];

function rangeBounds(key: RangeKey, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const to = customTo || now.toISOString().slice(0, 10);
  const start = customFrom ? new Date(customFrom) : new Date(now);
  
  if (key === "today") start.setHours(0, 0, 0, 0);
  else if (key === "7d") start.setDate(start.getDate() - 6);
  else if (key === "30d") start.setDate(start.getDate() - 29);
  else if (key === "month") start.setDate(1);
  else if (key === "custom" && customFrom) start.setHours(0, 0, 0, 0);
  
  return { from: start.toISOString().slice(0, 10), to };
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function ordersToCsv(orders: Order[]): string {
  const headers = [
    "Order #",
    "Date",
    "Type",
    "Status",
    "Table",
    "Customer",
    "Phone",
    "Subtotal",
    "Tax",
    "Total",
    "Payment Method(s)",
    "Items",
  ];
  
  const rows = orders.map((o) => {
    const items = o.order_items
      ?.map((i) => `${i.product_name} x${i.quantity} @ ${formatKina(i.unit_price)}`)
      .join("; ") || "";
    const payments = o.payments
      ?.map((p) => `${paymentMethodLabel(p.method)} ${formatKina(p.amount)}`)
      .join("; ") || "";
    
    return [
      o.order_number,
      formatDateTime(o.created_at),
      o.order_type,
      o.status,
      o.tables?.label || "",
      o.customer_name || "",
      o.customer_phone || "",
      formatKina(o.subtotal),
      formatKina(o.tax),
      formatKina(o.total),
      payments,
      items,
    ];
  });
  
  return [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
}

function paymentsToCsv(payments: Payment[], orders: Order[]): string {
  const headers = [
    "Order #",
    "Date",
    "Method",
    "Amount",
    "Reference",
    "Order Type",
    "Table",
  ];
  
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  
  const rows = payments.map((p) => {
    const order = orderMap.get(p.order_id);
    return [
      order?.order_number || "",
      formatDateTime(p.created_at),
      paymentMethodLabel(p.method),
      formatKina(p.amount),
      p.reference || "",
      order?.order_type || "",
      order?.tables?.label || "",
    ];
  });
  
  return [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
}

function expensesToCsv(expenses: Expense[]): string {
  const headers = [
    "Date",
    "Category",
    "Amount",
    "Note",
    "Recorded By",
  ];
  
  const rows = expenses.map((e) => [
    formatDateTime(e.created_at),
    e.category,
    formatKina(e.amount),
    e.note || "",
    e.created_by || "",
  ]);
  
  return [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
}

function cashupsToCsv(cashups: Cashup[], shifts: Shift[]): string {
  const headers = [
    "Date",
    "Shift",
    "Staff",
    "Cash Total",
    "EFTPOS Total",
    "Bank Transfer Total",
    "Refunds",
    "Expenses",
    "Net Sales",
    "Expected Cash",
    "Variance",
    "Closed By",
    "Closed At",
  ];
  
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  
  const rows = cashups.map((c) => {
    const shift = c.shift_id ? shiftMap.get(c.shift_id) : undefined;
    const expectedCash = Number(c.cash_total) + Number(c.eftpos_total) + Number(c.bank_transfer_total) - Number(c.refunds);
    const variance = Number(c.net_sales) - expectedCash;
    const clockIn = shift?.clock_in ?? "";
    const clockOut = shift?.clock_out ?? "";
    const hasClockIn = clockIn.length > 0;
    const hasClockOut = clockOut.length > 0;
    
    return [
      hasClockIn ? formatDate(clockIn) : "",
      hasClockIn ? `${formatTime(clockIn)} - ${hasClockOut ? formatTime(clockOut) : "Open"}` : "",
      shift?.staff?.full_name || "",
      formatKina(c.cash_total),
      formatKina(c.eftpos_total),
      formatKina(c.bank_transfer_total),
      formatKina(c.refunds),
      formatKina(c.expenses),
      formatKina(c.net_sales),
      formatKina(expectedCash),
      formatKina(variance),
      c.closed_by || "",
      c.closed_at ? formatDateTime(c.closed_at) : "",
    ];
  });
  
  return [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
}

function shiftsToCsv(shifts: Shift[]): string {
  const headers = [
    "Date",
    "Staff",
    "Role",
    "Clock In",
    "Clock Out",
    "Duration (hours)",
    "Status",
  ];
  
const rows = shifts.map((s) => {
    const clockInDate = s.clock_in ? new Date(s.clock_in) : null;
    const clockOutDate = s.clock_out ? new Date(s.clock_out) : null;
    const duration = clockInDate && clockOutDate 
      ? ((clockOutDate.getTime() - clockInDate.getTime()) / 3600000).toFixed(2)
      : clockInDate && !clockOutDate
        ? "In progress"
        : "";
    
    return [
      clockInDate ? formatDate(s.clock_in!) : "",
      clockInDate ? formatTime(s.clock_in!) : "",
      clockOutDate ? formatTime(s.clock_out!) : "",
      s.staff?.full_name || "",
      s.staff?.role || "",
      duration,
      clockOutDate ? "Completed" : clockInDate ? "Active" : "Not started",
    ];
  });
  
  return [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function AccountingClient({ restaurantId }: { restaurantId: string }) {
  const [range, setRange] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState<Partial<Record<ExportType, boolean>>>({});
  
  const { from, to } = rangeBounds(range, customFrom, customTo);
  
  const fetchOrders = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*), payments(*), tables(label), customer_name, customer_phone, customer_notes")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false });
    return (data as unknown as Order[]) ?? [];
  }, [restaurantId, from, to]);
  
  const fetchPayments = useCallback(async () => {
    const supabase = createClient();
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, order_type, tables(label)")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`);
    
    const orderIds = (orders as unknown as Order[])?.map((o) => o.id) || [];
    if (orderIds.length === 0) return [] as Payment[];
    
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });
    
    return (payments as unknown as Payment[]) ?? [];
  }, [restaurantId, from, to]);
  
  const fetchExpenses = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false });
    return (data as unknown as Expense[]) ?? [];
  }, [restaurantId, from, to]);
  
  const fetchCashups = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("cashups")
      .select("*, shifts(*, staff(full_name, role))")
      .eq("restaurant_id", restaurantId)
      .gte("closed_at", `${from}T00:00:00`)
      .lte("closed_at", `${to}T23:59:59`)
      .order("closed_at", { ascending: false });
    return (data as unknown as Cashup[]) ?? [];
  }, [restaurantId, from, to]);
  
  const fetchShifts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("shifts")
      .select("*, staff(full_name, role)")
      .eq("restaurant_id", restaurantId)
      .gte("clock_in", `${from}T00:00:00`)
      .lte("clock_in", `${to}T23:59:59`)
      .order("clock_in", { ascending: false });
    return (data as unknown as Shift[]) ?? [];
  }, [restaurantId, from, to]);

  async function exportData(type: ExportType) {
    setLoading((prev) => ({ ...prev, [type]: true }));
    
    try {
      let csv = "";
      const dateStr = `${from}_to_${to}`.replace(/-/g, "");
      
      switch (type) {
        case "orders": {
          const orders = await fetchOrders();
          csv = ordersToCsv(orders);
          downloadCsv(csv, `orders_${dateStr}.csv`);
          break;
        }
        case "payments": {
          const [orders, payments] = await Promise.all([fetchOrders(), fetchPayments()]);
          csv = paymentsToCsv(payments, orders);
          downloadCsv(csv, `payments_${dateStr}.csv`);
          break;
        }
        case "expenses": {
          const expenses = await fetchExpenses();
          csv = expensesToCsv(expenses);
          downloadCsv(csv, `expenses_${dateStr}.csv`);
          break;
        }
        case "cashups": {
          const [cashups, shifts] = await Promise.all([fetchCashups(), fetchShifts()]);
          csv = cashupsToCsv(cashups, shifts);
          downloadCsv(csv, `cashups_${dateStr}.csv`);
          break;
        }
        case "shifts": {
          const shifts = await fetchShifts();
          csv = shiftsToCsv(shifts);
          downloadCsv(csv, `shifts_${dateStr}.csv`);
          break;
        }
      }
      
      toast.success(`${EXPORTS.find((e) => e.type === type)?.label} exported successfully`);
    } catch (error) {
      toast.error(`Failed to export: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Accounting Exports</h1>
          <p className="text-sm text-muted-foreground">
            Export financial data for accounting and compliance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="range" className="text-sm font-medium">Date Range</Label>
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <Label htmlFor="from" className="text-sm font-medium">From</Label>
              <Input
                id="from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo || new Date().toISOString().slice(0, 10)}
                className="w-[160px]"
              />
              <Label htmlFor="to" className="text-sm font-medium">To</Label>
              <Input
                id="to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom}
                max={new Date().toISOString().slice(0, 10)}
                className="w-[160px]"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {EXPORTS.map((exp) => (
          <Card key={exp.type} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <exp.icon className="h-5 w-5 text-primary" />
                    {exp.label}
                  </CardTitle>
                  <CardDescription>{exp.description}</CardDescription>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(from)} – {formatDate(to)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                className={cn("w-full justify-start gap-2", loading[exp.type] && "opacity-50")}
                onClick={() => exportData(exp.type)}
                disabled={loading[exp.type]}
              >
                {loading[exp.type] ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <FileSpreadsheet className="h-5 w-5" />
            Full Accounting Package
          </CardTitle>
          <CardDescription>
            Export all data types in a single ZIP file with multiple CSV files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={async () => {
              setLoading((prev) => ({ ...prev, orders: true, payments: true, expenses: true, cashups: true, shifts: true }));
              try {
                const [orders, payments, expenses, cashups, shifts] = await Promise.all([
                  fetchOrders(),
                  fetchPayments(),
                  fetchExpenses(),
                  fetchCashups(),
                  fetchShifts(),
                ]);
                
                const zip = new (await import("jszip")).default();
                zip.file("orders.csv", ordersToCsv(orders));
                zip.file("payments.csv", paymentsToCsv(payments, orders));
                zip.file("expenses.csv", expensesToCsv(expenses));
                zip.file("cashups.csv", cashupsToCsv(cashups, shifts));
                zip.file("shifts.csv", shiftsToCsv(shifts));
                
                const content = await zip.generateAsync({ type: "blob" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(content);
                link.download = `accounting_${from}_to_${to}.zip`;
                link.click();
                URL.revokeObjectURL(link.href);
                
                toast.success("Full accounting package exported");
              } catch {
                toast.error("Failed to create package");
              } finally {
                setLoading({});
              }
            }}
            disabled={Object.values(loading).some(Boolean)}
          >
            {Object.values(loading).some(Boolean) ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating package...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export All (ZIP)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}