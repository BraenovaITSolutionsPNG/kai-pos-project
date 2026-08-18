"use client";

import { useState } from "react";
import {
  Banknote,
  Building,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Loader2,
  LogOut,
  Upload,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/lib/auth-actions";
import type {
  MyPaymentRow,
  MySubscriptionRow,
} from "@/lib/queries";
import { PLAN_LABELS, CYCLE_LABELS, PLAN_PRICES } from "@/lib/plans";
import {
  BANK_OPTIONS,
  PAYMENT_METHODS,
  isTransferMethod,
  paymentMethodHint,
  paymentMethodLabel,
} from "@/lib/payment-methods";
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
import { toast } from "sonner";

const METHODS = PAYMENT_METHODS;

function StatusBadge({ status }: { status: MyPaymentRow["status"] }) {
  if (status === "approved")
    return (
      <Badge className="gap-1 bg-emerald-600 text-white">
        <CheckCircle2 className="size-3" />
        Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="size-3" />
        Rejected
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1">
      <Loader2 className="size-3 animate-spin" />
      Pending
    </Badge>
  );
}

export function SubscriptionClient({
  subscription,
  payments,
  bankDetails,
}: {
  subscription: MySubscriptionRow;
  payments: MyPaymentRow[];
  bankDetails: {
    bank_name: string;
    account_name: string;
    account_number: string;
    branch: string;
    swift: string;
  };
}) {
  const [method, setMethod] = useState("bank_transfer");
  const [bank, setBank] = useState("bsp");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const active = subscription.status === "active";
  const hint = paymentMethodHint(method);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hint.referenceRequired && !reference.trim()) {
      toast.error(`Please enter the ${hint.referenceLabel.toLowerCase()}.`);
      return;
    }
    if (hint.proofRequired && !pendingFile) {
      toast.error(`Please attach ${hint.proofLabel.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    const supabase = createClient();

    let proofUrl: string | null = null;
    if (pendingFile) {
      const fd = new FormData();
      fd.append("file", pendingFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as {
        data?: { url: string };
        error?: { message: string } | null;
      };
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Image upload failed");
        setBusy(false);
        return;
      }
      proofUrl = json.data!.url;
    }

    const { error } = await supabase.rpc("submit_payment", {
      method,
      bank: isTransferMethod(method) ? bank : null,
      reference: reference.trim(),
      amount: amount ? Number(amount) : undefined,
      proof_url: proofUrl,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payment submitted for review. You will be notified once approved.");
    setReference("");
    setAmount("");
    setPendingFile(null);
    window.location.reload();
  }

  const due =
    subscription.status === "pending"
      ? `K ${PLAN_PRICES[subscription.plan][subscription.billing_cycle].toLocaleString()}`
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Subscription
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your plan and submit subscription payments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={logout}>
            <Button type="submit" variant="outline">
              <LogOut />
              Sign out
            </Button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-heading font-semibold capitalize">
              {PLAN_LABELS[subscription.plan]} ·{" "}
              {CYCLE_LABELS[subscription.billing_cycle]}
            </p>
            <p className="text-sm text-muted-foreground">
              {subscription.business_name}
            </p>
          </div>
          <StatusBadge status={subscription.status as MyPaymentRow["status"]} />
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">Amount due</dt>
            <dd className="font-semibold">
              K {PLAN_PRICES[subscription.plan][subscription.billing_cycle].toLocaleString()}
            </dd>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">Period</dt>
            <dd className="flex items-center gap-1.5 font-semibold">
              <CalendarDays className="size-3.5 text-muted-foreground" />
              {subscription.current_period_start} → {subscription.current_period_end}
            </dd>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="font-semibold capitalize">{subscription.status}</dd>
          </div>
        </dl>
        {!active && (
          <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
            {subscription.status === "pending"
              ? "Your payment is awaiting approval. Access to the platform is granted as soon as the KAI POS team confirms your payment."
              : "Your subscription is not active. Settle the amount below to regain access."}
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Building className="size-4 text-primary" />
            <h2 className="font-heading font-semibold">Company bank details</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Transfer your subscription payment to this account, then attach the
            screenshot below.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Bank</dt>
              <dd className="text-right font-medium">{bankDetails.bank_name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Account name</dt>
              <dd className="text-right font-medium">{bankDetails.account_name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Account number</dt>
              <dd className="text-right font-mono font-semibold">
                {bankDetails.account_number}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Branch</dt>
              <dd className="text-right font-medium">{bankDetails.branch}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">SWIFT / BPNG</dt>
              <dd className="text-right font-mono font-medium">{bankDetails.swift}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Banknote className="size-4 text-primary" />
            <h2 className="font-heading font-semibold">Submit payment proof</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Attach a screenshot of your bank transfer and the reference number.
            An admin will verify and approve it.
          </p>
          <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v ?? "bank_transfer")}>
                <SelectTrigger className="capitalize">
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
                  <SelectTrigger className="capitalize">
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
              <Label>Amount (K) — leave blank for {due ?? "plan price"}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={due ?? String(PLAN_PRICES[subscription.plan][subscription.billing_cycle])}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {hint.referenceLabel}
                {hint.referenceRequired && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={hint.referencePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {hint.proofLabel}
                {hint.proofRequired && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Upload />
                  Submit for review
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-3">
          <CreditCard className="size-4 text-primary" />
          <h2 className="font-heading font-semibold">Payment history</h2>
        </div>
        {payments.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No payments submitted yet.
          </p>
        ) : (
          <ul className="divide-y">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    K {Number(p.amount).toLocaleString()} ·{" "}
                    {paymentMethodLabel(p.method)}
                    {p.bank && (
                      <span className="uppercase"> · {p.bank.replace("_", " ")}</span>
                    )}
                    {p.reference && (
                      <span className="text-muted-foreground"> · {p.reference}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(p.created_at).toLocaleString()}
                    {p.approved_at && ` · ${p.status}`}
                  </p>
                  {p.proof_url && (
                    <a
                      href={p.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Upload className="size-3" />
                      View receipt
                    </a>
                  )}
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}