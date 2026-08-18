export type PlanName = "starter" | "business" | "professional";
export type BillingCycle = "monthly" | "annual";
export type SubscriptionStatus = "pending" | "active" | "expired" | "cancelled";
export type PaymentApprovalStatus = "pending" | "approved" | "rejected";

export const PLAN_PRICES: Record<PlanName, Record<BillingCycle, number>> = {
  starter: { monthly: 500, annual: 5000 },
  business: { monthly: 1500, annual: 15000 },
  professional: { monthly: 2500, annual: 25000 },
};

export const PLAN_LABELS: Record<PlanName, string> = {
  starter: "Starter",
  business: "Business",
  professional: "Professional",
};

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  annual: "Annual",
};

export function planPrice(plan: PlanName, cycle: BillingCycle): number {
  return PLAN_PRICES[plan][cycle];
}

export function planPeriodEnd(start: string, cycle: BillingCycle): string {
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start;
  if (cycle === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}