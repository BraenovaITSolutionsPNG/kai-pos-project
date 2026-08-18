"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CreditCard, Pencil, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatKina } from "@/lib/format";
import {
  CYCLE_LABELS,
  PLAN_LABELS,
  type BillingCycle,
  type PlanName,
} from "@/lib/plans";
import {
  BANK_OPTIONS,
  PAYMENT_METHODS,
  isTransferMethod,
  paymentMethodHint,
  paymentMethodLabel,
} from "@/lib/payment-methods";
import type {
  AdminSubscriptionRow,
  SubscriptionPaymentRow,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

function StatusBadge({
  status,
  daysLeft,
}: {
  status: AdminSubscriptionRow["status"];
  daysLeft: number;
}) {
  if (status !== "active")
    return <Badge variant="destructive">{status}</Badge>;
  if (daysLeft <= 7)
    return <Badge variant="destructive">Expiring in {daysLeft}d</Badge>;
  return <Badge variant="default">Active · {daysLeft}d left</Badge>;
}

const METHODS = PAYMENT_METHODS;

function RecordPaymentDialog({
  sub,
  onClose,
}: {
  sub: AdminSubscriptionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(sub.price));
  const [method, setMethod] = useState("bank_transfer");
  const [bank, setBank] = useState("bsp");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const hint = paymentMethodHint(method);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("record_subscription_payment", {
      subscription_id: sub.id,
      amount: Number(amount),
      method,
      bank: isTransferMethod(method) ? bank : null,
      reference: reference.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payment recorded, pending approval");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {sub.business_name} — {PLAN_LABELS[sub.plan]} (
            {CYCLE_LABELS[sub.billing_cycle]})
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (Kina)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v ?? "bank_transfer")}>
              <SelectTrigger className="w-full capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => {
                  const h = paymentMethodHint(m);
                  return (
                    <SelectItem key={m} value={m} disabled={h.comingSoon}>
                      {h.label}
                      {h.comingSoon && (
                        <span className="text-[11px] font-normal text-muted-foreground">
                          · Coming soon
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{hint.description}</p>
          </div>
          {isTransferMethod(method) && (
            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={bank} onValueChange={(v) => setBank(v ?? "bsp")}>
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANK_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b} className="capitalize">
                      {b === "other"
                        ? "Other bank"
                        : b.replace("_", " ").toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ref">{hint.referenceLabel}</Label>
            <Input
              id="ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={hint.referencePlaceholder}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditSubscriptionDialog({
  sub,
  onClose,
}: {
  sub: AdminSubscriptionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanName>(sub.plan);
  const [cycle, setCycle] = useState<BillingCycle>(sub.billing_cycle);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_subscription", {
      subscription_id: sub.id,
      plan,
      billing_cycle: cycle,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Subscription updated");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit subscription</DialogTitle>
          <DialogDescription>{sub.business_name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan((v ?? "starter") as PlanName)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Billing cycle</Label>
            <Select value={cycle} onValueChange={(v) => setCycle((v ?? "monthly") as BillingCycle)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Switching cycle resets the billing period from today.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReminderDialog({
  sub,
  onClose,
}: {
  sub: AdminSubscriptionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(
    `Hi! Your ${PLAN_LABELS[sub.plan]} plan for ${sub.business_name} renews on ${sub.current_period_end}. Please arrange payment so you stay on KAI POS.`
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("send_reminder", {
      subscription_id: sub.id,
      message: message.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reminder sent to the business owner");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send reminder</DialogTitle>
          <DialogDescription>
            Delivers an in-app notification to {sub.owner_email ?? "the owner"}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reminder">Message</Label>
            <textarea
              id="reminder"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reminder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionsClient({
  subscriptions,
  paymentsBySub,
}: {
  subscriptions: AdminSubscriptionRow[];
  paymentsBySub: Record<string, SubscriptionPaymentRow[]>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recordFor, setRecordFor] = useState<AdminSubscriptionRow | null>(null);
  const [editFor, setEditFor] = useState<AdminSubscriptionRow | null>(null);
  const [remindFor, setRemindFor] = useState<AdminSubscriptionRow | null>(null);

  async function run(rpc: string, args: Record<string, unknown>) {
    setBusyId(String(args.subscription_id ?? args.payment_id ?? "x"));
    const supabase = createClient();
    const { error } = await supabase.rpc(rpc, args);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Done");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Subscriptions & payments
        </h1>
        <p className="text-sm text-muted-foreground">
          {subscriptions.length} subscription(s). Record a payment when a
          business pays, then approve it to renew their plan.
        </p>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Period ends</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No subscriptions yet.
                </TableCell>
              </TableRow>
            ) : (
              subscriptions.map((sub) => {
                const payments = paymentsBySub[sub.id] ?? [];
                const pending = payments.filter((p) => p.status === "pending");
                return (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <p className="font-medium">{sub.business_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.owner_email ?? "no owner"} ·{" "}
                        {formatKina(sub.price)}/{sub.billing_cycle === "annual" ? "yr" : "mo"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {PLAN_LABELS[sub.plan]} · {CYCLE_LABELS[sub.billing_cycle]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{sub.current_period_end}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={sub.status} daysLeft={sub.days_left} />
                        {pending.length > 0 && (
                          <Badge variant="secondary">
                            {pending.length} payment(s) to approve
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId !== null}
                          onClick={() => setRecordFor(sub)}
                        >
                          <CreditCard />
                          Payment
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId !== null}
                          onClick={() => setEditFor(sub)}
                        >
                          <Pencil />
                          Plan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId !== null}
                          onClick={() => setRemindFor(sub)}
                        >
                          <Bell />
                          Remind
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {subscriptions.some((s) => (paymentsBySub[s.id] ?? []).length > 0) && (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Payment history</h2>
          {subscriptions.map((sub) => {
            const payments = paymentsBySub[sub.id] ?? [];
            if (payments.length === 0) return null;
            return (
              <div key={sub.id} className="rounded-xl border bg-card">
                <p className="border-b px-4 py-3 text-sm font-medium">
                  {sub.business_name}
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">
                          {new Date(p.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{formatKina(p.amount)}</TableCell>
                        <TableCell className="text-sm">
                          {paymentMethodLabel(p.method)}
                          {p.bank && (
                            <span className="block text-xs uppercase text-muted-foreground">
                              {p.bank.replace("_", " ")}
                            </span>
                          )}
                          {p.reference ? (
                            <span className="block text-xs text-muted-foreground">
                              {p.reference}
                            </span>
                          ) : null}
                          {p.proof_url ? (
                            <a
                              href={p.proof_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 block text-xs font-medium text-primary hover:underline"
                            >
                              View receipt
                            </a>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "approved"
                                ? "default"
                                : p.status === "rejected"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="capitalize"
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.status === "pending" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busyId !== null}
                                onClick={() =>
                                  void run("approve_subscription_payment", {
                                    payment_id: p.id,
                                  })
                                }
                              >
                                <Check />
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                disabled={busyId !== null}
                                onClick={() =>
                                  void run("reject_subscription_payment", {
                                    payment_id: p.id,
                                  })
                                }
                              >
                                <X />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {p.approved_at
                                ? `by ${p.created_by_email ?? "admin"}`
                                : "—"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}

      {recordFor && (
        <RecordPaymentDialog sub={recordFor} onClose={() => setRecordFor(null)} />
      )}
      {editFor && (
        <EditSubscriptionDialog sub={editFor} onClose={() => setEditFor(null)} />
      )}
      {remindFor && (
        <ReminderDialog sub={remindFor} onClose={() => setRemindFor(null)} />
      )}
    </div>
  );
}