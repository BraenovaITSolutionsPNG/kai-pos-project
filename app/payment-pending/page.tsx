import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMySubscription } from "@/lib/queries";
import { PLAN_LABELS, CYCLE_LABELS, PLAN_PRICES } from "@/lib/plans";
import { logout } from "@/lib/auth-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreditCard, Home, LogOut, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Payment pending",
};

export default async function PaymentPendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sub = await getMySubscription();
  if (!sub || sub.status === "active") redirect("/dashboard");

  const planPrice = PLAN_PRICES[sub.plan][sub.billing_cycle];

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex justify-end">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <Home />
            Back to home
          </Link>
        </div>
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CreditCard className="size-6" />
        </div>
        <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight">
          {sub.status === "pending"
            ? "Your payment is awaiting approval"
            : "Your subscription is not active"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sub.status === "pending"
            ? "We&apos;ve received your request. Once your subscription payment is confirmed by the KAI POS team, you&apos;ll get instant access to the platform."
            : "Your subscription payment has lapsed. Settle your plan to regain access to the platform."}
        </p>

        <div className="mt-6 space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Business</span>
            <span className="font-medium">{sub.business_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium capitalize">{PLAN_LABELS[sub.plan]}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Billing</span>
            <span className="font-medium capitalize">{CYCLE_LABELS[sub.billing_cycle]}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">K {planPrice.toLocaleString()}</span>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          Access is granted automatically the moment the admin approves your
          payment. Refresh this page after approval.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/subscription"
            className={cn(buttonVariants(), "w-full")}
          >
            <CreditCard />
            Submit payment proof
          </Link>
          <form action={logout}>
            <Button type="submit" variant="outline" className="w-full">
              <LogOut />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}