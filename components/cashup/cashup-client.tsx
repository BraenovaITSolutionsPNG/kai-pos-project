"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Clock,
  Download,
  Plus,
  RefreshCw,
  CalendarDays,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatKina, formatDateTime, formatDate, formatTime, paymentMethodLabel } from "@/lib/format";
import type {
  ShiftWithStaff,
  ShiftScheduleRow,
  StaffOption,
} from "@/lib/queries";
import type { Expense, Order, PaymentMethod } from "@/lib/types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  owner: { label: "Owner", className: "bg-primary text-primary-foreground" },
  manager: { label: "Manager", className: "" },
  cashier: { label: "Cashier", className: "" },
  kitchen: { label: "Kitchen", className: "" },
  waiter: { label: "Waiter", className: "" },
};

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

function computeShiftTotals(
  shift: ShiftWithStaff,
  orders: OrderWithRelations[],
  expenses: Expense[]
): ShiftTotals {
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
  shiftSchedules,
  staffOptions,
  userId,
  userRole,
  userStaffId,
}: {
  restaurantId: string;
  restaurantName: string;
  shifts: ShiftWithStaff[];
  expenses: Expense[];
  shiftSchedules: ShiftScheduleRow[];
  staffOptions: StaffOption[];
  userId: string;
  userRole: string;
  userStaffId: string;
}) {
  return (
    <Tabs defaultValue="reconcile" className="space-y-6">
      <TabsList>
        <TabsTrigger value="reconcile">
          <Calculator className="size-4" />
          End-of-Shift Cashup
        </TabsTrigger>
        <TabsTrigger value="schedule">
          <CalendarDays className="size-4" />
          Shift Schedule
        </TabsTrigger>
      </TabsList>
      <TabsContent value="reconcile">
        <ReconciliationTab
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          shifts={shifts}
          expenses={expenses}
          userId={userId}
          shiftSchedules={shiftSchedules}
        />
      </TabsContent>
      <TabsContent value="schedule">
        <ScheduleManager
          restaurantId={restaurantId}
          schedules={shiftSchedules}
          staffOptions={staffOptions}
          userId={userId}
          currentUserRole={userRole}
          currentUserStaffId={userStaffId}
          shifts={shifts}
        />
      </TabsContent>
    </Tabs>
  );
}

function ReconciliationTab({
  restaurantId,
  restaurantName,
  shifts,
  expenses,
  userId,
  shiftSchedules,
}: {
  restaurantId: string;
  restaurantName: string;
  shifts: ShiftWithStaff[];
  expenses: Expense[];
  userId: string;
  shiftSchedules: ShiftScheduleRow[];
}) {
  const router = useRouter();
  const [selectedShift, setSelectedShift] = useState<ShiftWithStaff | null>(null);
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [cashupOpen, setCashupOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ShiftWithStaff | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cashupData, setCashupData] = useState<Record<string, string>>({
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
  // Derive the active shift straight from the server-provided shifts list so
  // the UI can never show a stale "in progress" shift. Refreshing (after
  // clock in/out) re-fetches this prop and keeps the card in sync.
  const activeShift = shifts.find((s) => !s.clock_out) ?? null;

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

  const selectedTotals = selectedShift
    ? computeShiftTotals(selectedShift, orders, expenses)
    : null;

  async function startShift() {
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("clock_in");
      if (error) {
        if (/already clocked in/i.test(error.message)) {
          router.refresh();
          return;
        }
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
        if (/no active shift/i.test(error.message)) {
          toast.success("Shift already ended");
          router.refresh();
          return;
        }
        toast.error(error.message);
        return;
      }
      toast.success("Shift ended");
      router.refresh();
    } catch {
      toast.error("Failed to end shift");
    }
  }

  function deleteShift(shift: ShiftWithStaff) {
    setPendingDelete(shift);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("shifts")
        .delete()
        .eq("id", pendingDelete.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (selectedShift?.id === pendingDelete.id) setSelectedShift(null);
      toast.success("Shift deleted");
      setPendingDelete(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete shift");
    } finally {
      setDeleting(false);
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

      const { error } = await supabase.from("cashups").insert({
        restaurant_id: restaurantId,
        shift_id: selectedShift.id,
        cash_total: cashTotal,
        eftpos_total: eftposTotal,
        bank_transfer_total:
          bankTransferTotal +
          bspTotal +
          kinaBankTotal +
          anzTotal +
          westpacTotal +
          otherTotal,
        refunds,
        expenses: totals.totalExpenses,
        net_sales: totals.gross - totals.totalExpenses,
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

  const declaredTotal = PAYMENT_METHODS.reduce(
    (sum, m) => sum + Number(cashupData[m]),
    0
  );
  const variance = declaredTotal - (selectedTotals?.gross ?? 0);

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
                  <p className="font-medium text-green-800">
                    Shift in progress — {activeShift.staff_name}
                  </p>
                  {(() => {
                    const sch = activeShift.scheduled_shift_id
                      ? shiftSchedules.find((s) => s.id === activeShift.scheduled_shift_id)
                      : undefined;
                    const started =
                      activeShift.clock_in && activeShift.clock_in !== "0001-01-01T00:00:00"
                        ? formatDateTime(activeShift.clock_in)
                        : sch
                        ? formatTime(sch.start_time)
                        : "start time not recorded";
                    return (
                      <>
                        <p className="text-sm text-green-700">Started {started}</p>
                        {sch && (
                          <p className="text-xs text-green-600">
                            Scheduled {formatTime(sch.start_time)} –{" "}
                            {formatTime(sch.end_time)}
                            {sch.notes ? ` · ${sch.notes}` : ""}
                          </p>
                        )}
                      </>
                    );
                  })()}
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
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No shifts recorded yet.
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  Staff clock in through the POS to create shift records.
                </p>
                <a
                  href="/shifts"
                  className="text-primary hover:underline text-sm"
                >
                  View or schedule shifts
                </a>
              </div>
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
                    const badge = ROLE_BADGE[shift.staff_role] ?? ROLE_BADGE.cashier;
                    return (
                      <TableRow
                        key={shift.id}
                        className={isSelected ? "bg-primary/5" : undefined}
                        onClick={() => setSelectedShift(shift)}
                      >
                        <TableCell>
                          {formatDateTime(shift.clock_in).split(",")[0]}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            {shift.staff_name}
                            <Badge
                              variant="outline"
                              className={`text-xs ${badge.className}`}
                            >
                              {badge.label}
                            </Badge>
                          </span>
                        </TableCell>
                        <TableCell>{formatDateTime(shift.clock_in)}</TableCell>
                        <TableCell>
                          {shift.clock_out ? (
                            formatDateTime(shift.clock_out)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {shift.cashed_up ? (
                            <Badge variant="secondary">Cashed up</Badge>
                          ) : isActive ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Closed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isActive && !shift.cashed_up && (
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
                          {shift.cashed_up && (
                            <span className="text-xs text-muted-foreground">
                              Reconciled
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteShift(shift);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
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
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={loadOrders}
            >
              <RefreshCw />
              Refresh Data
            </Button>
            {selectedShift && selectedTotals && !selectedShift.cashed_up && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={exportShiftCSV}
                >
                  <Download />
                  Export Shift CSV
                </Button>
                <Button
                  className="w-full justify-start"
                  onClick={() => setCashupOpen(true)}
                >
                  <Calculator />
                  Perform Cashup
                </Button>
              </>
            )}
            {selectedShift && selectedShift.cashed_up && (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                This shift has already been reconciled.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedShift && selectedTotals && !selectedShift.cashed_up && (
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
                  <p className="mt-1 font-heading text-2xl font-semibold">
                    {selectedTotals.orders.length}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">
                    {formatKina(selectedTotals.subtotal)}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Tax</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">
                    {formatKina(selectedTotals.tax)}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Gross Sales</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">
                    {formatKina(selectedTotals.gross)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold mb-3">Payment Methods (Expected)</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PAYMENT_METHODS.map((method) => {
                    const expected = selectedTotals.totals[method] ?? 0;
                    return expected > 0 ? (
                      <div key={method} className="rounded-lg border p-3">
                        <p className="text-sm text-muted-foreground">
                          {paymentMethodLabel(method)}
                        </p>
                        <p className="font-heading font-semibold">
                          {formatKina(expected)}
                        </p>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>

              {selectedTotals.totalExpenses > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-semibold mb-3 text-amber-800">
                    Expenses in Shift
                  </h3>
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
                    <p className="font-semibold">{formatKina(declaredTotal)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Refunds</p>
                    <p className="font-semibold">
                      {formatKina(Number(cashupData.refunds))}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Variance</p>
                    <p
                      className={`font-semibold ${
                        Number(variance.toFixed(2)) === 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatKina(variance)}
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

        <Dialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete shift</DialogTitle>
              <DialogDescription>
                Delete the shift for {pendingDelete?.staff_name} on{" "}
                {pendingDelete ? formatDate(pendingDelete.clock_in) : ""}? This
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

function ScheduleManager({
  restaurantId,
  schedules,
  staffOptions,
  userId,
  currentUserRole,
  currentUserStaffId,
  shifts,
}: {
  restaurantId: string;
  schedules: ShiftScheduleRow[];
  staffOptions: StaffOption[];
  userId: string;
  currentUserRole: string;
  currentUserStaffId: string;
  shifts: ShiftWithStaff[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ShiftScheduleRow[]>(schedules);

  // A manager can only schedule cashiers, kitchen staff and themselves.
  // The owner (top of the hierarchy) can schedule anyone.
  const canManage = (role: string, staffId: string) =>
    currentUserRole === "owner" ||
    role === "cashier" ||
    role === "kitchen" ||
    role === "waiter" ||
    staffId === currentUserStaffId;

  const selectableStaff = staffOptions.filter((o) => canManage(o.role, o.id));
  const visibleRows = rows.filter((s) => canManage(s.staff_role, s.staff_id));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftScheduleRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<ShiftScheduleRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [form, setForm] = useState({
    staff_id: "",
    schedule_date: "",
    start_time: "",
    end_time: "",
    notes: "",
  });

  useEffect(() => {
    const current = schedules;
    void Promise.resolve().then(() => setRows(current));
  }, [schedules]);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("shift_schedules")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("schedule_date", { ascending: true })
      .order("start_time", { ascending: true });
    const list = (data ?? []) as ShiftScheduleRow[];
    setRows(
      list.map((s) => ({
        ...s,
        staff_name: staffOptions.find((o) => o.id === s.staff_id)?.name ?? "Unknown",
        staff_role: staffOptions.find((o) => o.id === s.staff_id)?.role ?? "cashier",
      }))
    );
  }, [restaurantId, staffOptions]);

  function openAdd() {
    setEditing(null);
    setForm({
      staff_id: selectableStaff[0]?.id ?? "",
      schedule_date: new Date().toISOString().slice(0, 10),
      start_time: "09:00",
      end_time: "17:00",
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(s: ShiftScheduleRow) {
    setEditing(s);
    setForm({
      staff_id: s.staff_id,
      schedule_date: s.schedule_date,
      start_time: s.start_time,
      end_time: s.end_time,
      notes: s.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.staff_id || !form.schedule_date || !form.start_time || !form.end_time) {
      toast.error("Please fill in staff, date and times");
      return;
    }
    if (form.start_time >= form.end_time) {
      toast.error("End time must be after start time");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const payload = {
      restaurant_id: restaurantId,
      staff_id: form.staff_id,
      schedule_date: form.schedule_date,
      start_time: form.start_time,
      end_time: form.end_time,
      notes: form.notes,
      created_by: userId,
    };
    const { error } = editing
      ? await supabase.from("shift_schedules").update(payload).eq("id", editing.id)
      : await supabase.from("shift_schedules").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Shift updated" : "Shift scheduled");
    setDialogOpen(false);
    await reload();
  }

  function remove(s: ShiftScheduleRow) {
    setPendingRemove(s);
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("shift_schedules")
        .delete()
        .eq("id", pendingRemove.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Scheduled shift removed");
      setPendingRemove(null);
      await reload();
    } catch {
      toast.error("Failed to remove scheduled shift");
    } finally {
      setRemoving(false);
    }
  }

  // Group by date
  const byDate = new Map<string, ShiftScheduleRow[]>();
  for (const s of visibleRows) {
    if (!byDate.has(s.schedule_date)) byDate.set(s.schedule_date, []);
    byDate.get(s.schedule_date)!.push(s);
  }
  const dates = [...byDate.keys()].sort();

  // Relate scheduled shifts to the actual clocked shifts.
  const activeStaffIds = new Set(
    shifts.filter((s) => !s.clock_out).map((s) => s.staff_id)
  );
  const shiftBySchedule = new Map<string, ShiftWithStaff>();
  for (const s of shifts) {
    if (s.scheduled_shift_id) shiftBySchedule.set(s.scheduled_shift_id, s);
  }
  function scheduleStatus(row: ShiftScheduleRow): "scheduled" | "in_progress" | "completed" {
    const linked = shiftBySchedule.get(row.id);
    if (linked) return linked.clock_out ? "completed" : "in_progress";
    if (activeStaffIds.has(row.staff_id)) return "in_progress";
    return "scheduled";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Shift Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan who works when. Schedules are visible to your whole team.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus />
          Schedule Shift
        </Button>
      </div>

      {selectableStaff.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No team members available to schedule. You can schedule cashiers,
            waiters, kitchen staff and yourself.
          </CardContent>
        </Card>
      ) : visibleRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No shifts scheduled yet. Click “Schedule Shift” to plan your week.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => (
            <Card key={date}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-PG", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </CardTitle>
                <CardDescription>
                  {byDate.get(date)!.length} shift
                  {byDate.get(date)!.length === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {byDate.get(date)!.map((s) => {
                    const badge = ROLE_BADGE[s.staff_role] ?? ROLE_BADGE.cashier;
                    const status = scheduleStatus(s);
                    const statusBadge =
                      status === "in_progress"
                        ? { label: "In progress", className: "bg-green-100 text-green-800" }
                        : status === "completed"
                        ? { label: "Completed", className: "bg-blue-100 text-blue-800" }
                        : { label: "Scheduled", className: "" };
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Users className="size-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{s.staff_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                              {s.notes ? ` · ${s.notes}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${badge.className}`}
                          >
                            {badge.label}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => void remove(s)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Scheduled Shift" : "Schedule Shift"}</DialogTitle>
            <DialogDescription>
              Assign a team member to a shift on a specific date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sched-staff">Staff member</Label>
              <select
                id="sched-staff"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.staff_id}
                onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))}
              >
                {selectableStaff.map((o) => (
                  <option key={o.id} value={o.id} disabled={!o.is_active}>
                    {o.name} ({o.role})
                    {o.is_active ? "" : " — inactive"}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sched-date">Date</Label>
                <Input
                  id="sched-date"
                  type="date"
                  value={form.schedule_date}
                  onChange={(e) => setForm((f) => ({ ...f, schedule_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-notes">Notes (optional)</Label>
              <Input
                id="sched-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Opening shift, cover for Mary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove scheduled shift</DialogTitle>
            <DialogDescription>
              Remove the scheduled shift for {pendingRemove?.staff_name} on{" "}
              {pendingRemove ? pendingRemove.schedule_date : ""}? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingRemove(null)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemove}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
