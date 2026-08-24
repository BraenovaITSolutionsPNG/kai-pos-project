"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKina } from "@/lib/format";
import { CreditCard, Coins, Loader2, CheckCircle, AlertCircle, Receipt, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TableBill {
  tableId: string;
  label: string;
  orders: Array<{
    id: string;
    order_number: number;
    status: string;
    subtotal: number;
    tax: number;
    total: number;
    table_id: string | null;
    created_at: string;
    order_items: Array<{
      product_name: string;
      quantity: number;
      unit_price: number;
      notes: string | null;
    }>;
    tables: { label: string | null } | null;
  }>;
  total: number;
}

interface BillsClientProps {
  tableBills: TableBill[];
  restaurantId: string;
}

const paymentMethods = [
  { value: "cash", label: "Cash", icon: Coins },
  { value: "eftpos", label: "EFTPOS", icon: CreditCard },
  { value: "bank_transfer", label: "Bank Transfer", icon: CreditCard },
  { value: "bsp", label: "BSP", icon: CreditCard },
  { value: "kina_bank", label: "Kina Bank", icon: CreditCard },
  { value: "anz", label: "ANZ", icon: CreditCard },
  { value: "westpac", label: "Westpac", icon: CreditCard },
  { value: "other", label: "Other", icon: CreditCard },
] as const;

type PaymentMethodValue = typeof paymentMethods[number]["value"];

export function BillsClient({ tableBills, restaurantId }: BillsClientProps) {
  const [chargingTable, setChargingTable] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodValue>("cash");
  const [charging, setCharging] = useState(false);

  async function settleTable(tableId: string) {
    if (!selectedMethod) {
      toast.error("Select a payment method");
      return;
    }
    setCharging(true);
    const supabase = createClient();

    const { data, error } = await supabase.rpc("settle_self_service_table", {
      p_table: tableId,
      p_method: selectedMethod,
    });

    setCharging(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Table settled — ${formatKina(data ?? 0)} collected via ${paymentMethods.find(m => m.value === selectedMethod)?.label ?? selectedMethod}`);
    // Refresh the page to get updated bills
    window.location.reload();
  }

  if (tableBills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Receipt className="h-16 w-16 mb-4 opacity-50" />
        <h3 className="font-semibold text-lg">No open self-service bills</h3>
        <p className="text-sm mt-1">Customers haven't placed any QR orders yet, or all tables are settled.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Bills (Self-Service)</h1>
          <p className="text-muted-foreground mt-1">
            Tables with open customer orders. Charge when customers leave.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">Total to collect:</span>
          <span className="font-heading text-xl font-semibold text-primary">
            {formatKina(tableBills.reduce((sum, t) => sum + t.total, 0))}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tableBills.map((bill) => (
          <Card key={bill.tableId} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5" />
                  {bill.label}
                </CardTitle>
                <Badge variant={bill.total > 0 ? "default" : "secondary"}>
                  {formatKina(bill.total)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {bill.orders.map((order) => (
                  <div key={order.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono font-medium">#{order.order_number}</span>
                          <Badge
                            variant={
                              order.status === "ready" ? "default"
                              : order.status === "served" ? "secondary"
                              : "outline"
                            }
                          >
                            {order.status}
                          </Badge>
                        </div>
                        <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {order.order_items.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{item.quantity}× {item.product_name}</span>
                              <span>{formatKina(item.unit_price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="font-heading font-medium text-primary whitespace-nowrap">
                        {formatKina(order.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t flex items-center justify-between">
                <span className="font-semibold">Table Total</span>
                <span className="font-heading text-lg font-semibold text-primary">
                  {formatKina(bill.total)}
                </span>
              </div>

              <Dialog open={chargingTable === bill.tableId} onOpenChange={(open) => !open && setChargingTable(null)}>
                <DialogTrigger>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setChargingTable(bill.tableId)}
                    disabled={charging}
                  >
                    {charging && chargingTable === bill.tableId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Charging…
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Charge Table
                      </>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Charge {bill.label}</DialogTitle>
                    <DialogDescription>
                      Total: <strong>{formatKina(bill.total)}</strong>. Select payment method and confirm.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    {paymentMethods.map((method) => (
                      <label
                        key={method.value}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          selectedMethod === method.value
                            ? "border-primary bg-primary/5"
                            : "hover:bg-accent"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value={method.value}
                          checked={selectedMethod === method.value}
                          onChange={() => setSelectedMethod(method.value)}
                          className="sr-only"
                        />
                        <method.icon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{method.label}</span>
                      </label>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setChargingTable(null)} disabled={charging}>
                      Cancel
                    </Button>
                    <Button onClick={() => settleTable(bill.tableId)} disabled={charging}>
                      {charging ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Confirm
                        </>
                      ) : (
                        `Charge ${formatKina(bill.total)}`
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}