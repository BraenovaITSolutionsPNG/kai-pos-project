import type { StaffRole } from "@/lib/types";

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

// --- Role & feature gating by plan ---

// Roles that may be assigned on each plan. A Starter business is single-user
// (owner only); Business adds manager + cashier; Professional unlocks every role.
export const PLAN_ROLES: Record<PlanName, StaffRole[]> = {
  starter: ["owner"],
  business: ["owner", "manager", "cashier"],
  professional: ["owner", "manager", "cashier", "kitchen", "waiter"],
};

// Routes gated by plan in addition to role. A Starter business cannot use the
// digital menu / QR self-service ordering.
export const PLAN_GATED_ROUTES: Record<string, PlanName[]> = {
  "/digital-menu": ["business", "professional"],
  "/promotions": ["business", "professional"],
  "/accounting": ["business", "professional"],
  "/loyalty": ["business", "professional"],
};

export function isRoleAllowedForPlan(role: StaffRole, plan: PlanName): boolean {
  return PLAN_ROLES[plan]?.includes(role) ?? false;
}

export function isRouteAllowedForPlan(path: string, plan: PlanName): boolean {
  const allowed = PLAN_GATED_ROUTES[path];
  if (!allowed) return true;
  return allowed.includes(plan);
}

export function planHasDigitalMenu(plan: PlanName): boolean {
  return plan !== "starter";
}

export function planHasOnlineOrdering(plan: PlanName): boolean {
  return plan !== "starter";
}

export function planHasAccounting(plan: PlanName): boolean {
  return plan !== "starter";
}

export function planHasLoyalty(plan: PlanName): boolean {
  return plan !== "starter";
}

// Roles that can be assigned through the Staff UI (owner is created at signup
// and is never in this list).
export function assignableRolesForPlan(plan: PlanName): StaffRole[] {
  return PLAN_ROLES[plan].filter((r) => r !== "owner");
}
