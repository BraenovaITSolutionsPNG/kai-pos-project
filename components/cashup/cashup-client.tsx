"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Clock, Download, Plus, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatKina, formatDateTime, paymentMethodLabel } from "@/lib/format";
import type { Shift, Expense, PaymentMethod, Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "eftpos",
  "bank_transfer",
  "bsp",
  "kina_bank",
  "anz",
  "westpac",
  "other",
];

interface OrderWithRelations extends Order {
  order_items: Order["order_items"];
  payments: Order["payments"];
}

interface ShiftTotals {
  orders: OrderWithRelations[];
  subtotal: number;
  tax: number;
  gross: number;
  totals: Record<PaymentMethod, number>;
  expenses: Expense[];
  totalExpenses: number;
  netSales: number;
}

function computeShiftTotals(shift: Shift, orders: OrderWithRelations[], expenses: Expense[]): ShiftTotals {
  const shiftStart = new Date(shift.clock_in).getTime();
  const shiftEnd = shift.clock_out ? new Date(shift.clock_out).getTime() : Date.now();

  const shiftOrders = orders.filter((o) => {
    const orderTime = new Date(o.created_at).getTime();
    return orderTime >= shiftStart && orderTime <= shiftEnd && o.status === "paid";
  });

  const totals = {
    cash: 0,
    eftpos: 0,
    bank_transfer: 0,
    bsp: 0,
    kina_bank: 0,
    anz: 0,
    westpac: 0,
    other: 0,
  } as Record<PaymentMethod, number>;

  let subtotal = 0;
  let tax = 0;
  let gross = 0;

  for (const order of shiftOrders) {
    subtotal += Number(order.subtotal);
    tax += Number(order.tax);
    gross += Number(order.total);
    for (const payment of order.payments ?? []) {
      if (payment.method in totals) {
        totals[payment.method as PaymentMethod] += Number(payment.amount);
      }
    }
  }

  const shiftExpenses = expenses.filter((e) => {
    const expTime = new Date(e.created_at).getTime();
    return expTime >= shiftStart && expTime <= shiftEnd;
  });
  const totalExpenses = shiftExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const netSales = gross - totalExpenses;

  return {
    orders: shiftOrders,
    subtotal,
    tax,
    gross,
    totals,
    expenses: shiftExpenses,
    totalExpenses,
    netSales,
  };
}

export function CashupClient({
  restaurantId,
  restaurantName,
  shifts,
  expenses,
  userId,
  userRole,
}: {
  restaurantId: string;
  restaurantName: string;
  shifts: Shift[];
  expenses: Expense[];
  userId: string;
  userRole: string;
}) {
  const router = useRouter();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [cashupOpen, setCashupOpen] = useState(false);
  const [cashupData, setCashupData] = useState<{
    cash: string;
    eftpos: string;
    bank_transfer: string;
    bsp: string;
    kina_bank: string;
    anz: string;
    westpac: string;
    other: string;
    refunds: string;
  }>({
    cash: "0",
    eftpos: "0",
    bank_transfer: "0",
    bsp: "0",
    kina_bank: "0",
    anz: "0",
    westpac: "0",
    other: "0",
    refunds: "0",
  });
  const [cashupBusy, setCashupBusy] = useState(false);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  const loadOrders = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*), payments(*)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });
    if (data) setOrders(data as unknown as OrderWithRelations[]);
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*), payments(*)")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (!cancelled && data) setOrders(data as unknown as OrderWithRelations[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  // Check for active shift on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("get_active_shift").then(({ data }) => {
      if (data) setActiveShift(data as Shift);
    });
  }, []);

  const selectedTotals = selectedShift
    ? computeShiftTotals(selectedShift, orders, expenses)
    : null;

  async function startShift() {
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("clock_in");
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Shift started");
      router.refresh();
    } catch {
      toast.error("Failed to start shift");
    }
  }

  async function endShift() {
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("clock_out");
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Shift ended");
      router.refresh();
    } catch {
      toast.error("Failed to end shift");
    }
  }

  async function performCashup() {
    if (!selectedShift || !selectedTotals) return;
    setCashupBusy(true);
    try {
      const supabase = createClient();
      const totals = selectedTotals;
      const cashTotal = Number(cashupData.cash);
      const eftposTotal = Number(cashupData.eftpos);
      const bankTransferTotal = Number(cashupData.bank_transfer);
      const bspTotal = Number(cashupData.bsp);
      const kinaBankTotal = Number(cashupData.kina_bank);
      const anzTotal = Number(cashupData.anz);
      const westpacTotal = Number(cashupData.westpac);
      const otherTotal = Number(cashupData.other);
      const refunds = Number(cashupData.refunds);

      const declaredTotal =
        cashTotal +
        eftposTotal +
        bankTransferTotal +
        bspTotal +
        kinaBankTotal +
        anzTotal +
        westpacTotal +
        otherTotal;

      const expectedTotal = totals.gross;

      const { error } = await supabase
        .from("cashups")
        .insert({
          restaurant_id: restaurantId,
          shift_id: selectedShift.id,
          cash_total: cashTotal,
          eftpos_total: eftposTotal,
          bank_transfer_total: bankTransferTotal + bspTotal + kinaBankTotal + anzTotal + westpacTotal + otherTotal,
          refunds,
          expenses: totals.totalExpenses,
          net_sales: expectedTotal - totals.totalExpenses,
          closed_by: userId,
        });

      if (error) {
        toast.error(error.message);
        setCashupBusy(false);
        return;
      }

      toast.success("Cashup completed");
      setCashupOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to complete cashup");
    } finally {
      setCashupBusy(false);
    }
  }

  function handleCashupInputChange(key: string, value: string) {
    setCashupData((prev) => ({ ...prev, [key]: value }));
  }

  function exportShiftCSV() {
    if (!selectedShift || !selectedTotals) return;
    const totals = selectedTotals;
    const rows = totals.orders.map((o) => ({
      Order: o.order_number,
      Date: formatDateTime(o.created_at),
      Subtotal: Number(o.subtotal).toFixed(2),
      Tax: Number(o.tax).toFixed(2),
      Total: Number(o.total).toFixed(2),
      Payment: o.payments?.[0]?.method
        ? paymentMethodLabel(o.payments[0].method as PaymentMethod)
        : "",
    }));
    const header = Object.keys(rows[0] ?? {}).join(",");
    const csv = [header, ...rows.map((r) => Object.values(r).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shift-${selectedShift.id}-${formatDateTime(selectedShift.clock_in).replace(/[/,:]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Cashup
          </h1>
          <p className="text-sm text-muted-foreground">
            End-of-shift reconciliation for {restaurantName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeShift ? (
            <>
              <Badge className="bg-green-100 text-green-800">Active Shift</Badge>
              <Button variant="outline" onClick={endShift}>
                <Clock />
                End Shift
              </Button>
            </>
          ) : (
            <Button onClick={startShift}>
              <Plus />
              Start Shift
            </Button>
          )}
        </div>
      </div>

      {activeShift && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="size-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Shift in progress</p>
                  <p className="text-sm text-green-700">
                    Started {formatDateTime(activeShift.clock_in)}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={endShift}>
                End Shift
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Select Shift</CardTitle>
            <CardDescription>
              Choose a completed shift to view sales and perform cashup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {shifts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No shifts recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => {
                    const isActive = !shift.clock_out;
                    const isSelected = selectedShift?.id === shift.id;
                    return (
                      <TableRow
                        key={shift.id}
                        className={isSelected ? "bg-primary/5" : undefined}
                        onClick={() => setSelectedShift(shift)}
                      >
                        <TableCell>{formatDateTime(shift.clock_in).split(",")[0]}</TableCell>
                        <TableCell>{shift.staff_id.slice(0, 8)}</TableCell>
                        <TableCell>{formatDateTime(shift.clock_in)}</TableCell>
                        <TableCell>
                          {shift.clock_out
                            ? formatDateTime(shift.clock_out)
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isActive ? "default" : "secondary"}>
                            {isActive ? "Active" : "Closed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShift(shift);
                              }}
                            >
                              View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={loadOrders}>
              <RefreshCw />
              Refresh Data
            </Button>
            {selectedShift && selectedTotals && (
              <>
                <Button variant="outline" className="w-full justify-start" onClick={exportShiftCSV}>
                  <Download />
                  Export Shift CSV
                </Button>
                <Button className="w-full justify-start" onClick={() => setCashupOpen(true)}>
                  <Calculator />
                  Perform Cashup
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedShift && selectedTotals && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shift Summary</CardTitle>
              <CardDescription>
                Shift from {formatDateTime(selectedShift.clock_in)} to{" "}
                {selectedShift.clock_out
                  ? formatDateTime(selectedShift.clock_out)
                  : "now"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Orders</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">{selectedTotals.orders.length}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">{formatKina(selectedTotals.subtotal)}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Tax</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">{formatKina(selectedTotals.tax)}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Gross Sales</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">{formatKina(selectedTotals.gross)}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold mb-3">Payment Methods (Expected)</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PAYMENT_METHODS.map((method) => {
                    const expected = selectedTotals.totals[method] ?? 0;
                    return expected > 0 ? (
                      <div key={method} className="rounded-lg border p-3">
                        <p className="text-sm text-muted-foreground">{paymentMethodLabel(method)}</p>
                        <p className="font-heading font-semibold">{formatKina(expected)}</p>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>

              {selectedTotals.totalExpenses > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-semibold mb-3 text-amber-800">Expenses in Shift</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {selectedTotals.expenses.map((e) => (
                      <div key={e.id} className="rounded-lg border bg-white p-3">
                        <p className="text-sm text-amber-800">{e.category}</p>
                        <p className="font-semibold">{formatKina(e.amount)}</p>
                      </div>
                    ))}
                    <div className="rounded-lg border bg-amber-100 p-3 font-semibold">
                      <p className="text-amber-800">Total Expenses</p>
                      <p>{formatKina(selectedTotals.totalExpenses)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Net Sales (Gross - Expenses)</span>
                  <span>{formatKina(selectedTotals.netSales)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={cashupOpen} onOpenChange={setCashupOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Perform Cashup</DialogTitle>
            <DialogDescription>
              Enter the actual amounts counted for each payment method.
            </DialogDescription>
          </DialogHeader>
          {selectedTotals && (
            <form className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Declared Amounts</h4>
                {PAYMENT_METHODS.map((method) => {
                  const expected = selectedTotals.totals[method] ?? 0;
                  return expected > 0 ? (
                    <div key={method} className="grid grid-cols-3 gap-3 items-center">
                      <Label className="text-sm">{paymentMethodLabel(method)}</Label>
                      <span className="text-sm text-muted-foreground col-span-1 sm:col-span-2">
                        Expected: {formatKina(expected)}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashupData[method]}
                        onChange={(e) => handleCashupInputChange(method, e.target.value)}
                        placeholder="0.00"
                        className="w-full sm:w-[120px]"
                      />
                    </div>
                  ) : null;
                })}
                <div className="grid grid-cols-3 gap-3 items-center border-t pt-3">
                  <Label className="text-sm">Refunds</Label>
                  <span className="text-sm text-muted-foreground col-span-1 sm:col-span-2" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashupData.refunds}
                    onChange={(e) => handleCashupInputChange("refunds", e.target.value)}
                    placeholder="0.00"
                    className="w-full sm:w-[120px]"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-4">
                <h4 className="font-medium mb-3">Variance Check</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Expected Total</p>
                    <p className="font-semibold">{formatKina(selectedTotals.gross)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Declared Total</p>
                    <p className="font-semibold">
                      {formatKina(
                        PAYMENT_METHODS.reduce(
                          (sum, m) => sum + Number(cashupData[m]),
                          0
                        )
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Refunds</p>
                    <p className="font-semibold">{formatKina(Number(cashupData.refunds))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Variance</p>
                    <p
                      className={`font-semibold ${
                        PAYMENT_METHODS.reduce((sum, m) => sum + Number(cashupData[m]), 0) -
                          selectedTotals.gross -
                          Number(cashupData.refunds) ===
                        0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatKina(
                        PAYMENT_METHODS.reduce((sum, m) => sum + Number(cashupData[m]), 0) -
                          selectedTotals.gross -
                          Number(cashupData.refunds)
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCashupOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={performCashup} disabled={cashupBusy}>
                  {cashupBusy ? "Processing…" : "Complete Cashup"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}