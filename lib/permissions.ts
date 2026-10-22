import { redirect } from "next/navigation";
import type { StaffRole } from "@/lib/types";
import { isRouteAllowedForPlan, type PlanName } from "@/lib/plans";

export type { StaffRole };

const ALL_ROUTES = [
  "/dashboard",
  "/pos",
  "/orders",
  "/products",
  "/categories",
  "/tables",
  "/kitchen",
  "/inventory",
  "/recipes",
  "/reports",
  "/accounting",
  "/owner",
  "/loyalty",
  "/cashup",
  "/staff",
  "/digital-menu",
  "/promotions",
  "/bills",
  "/settings",
  "/messages",
];

// Which routes each role may access. Everyone keeps /dashboard so the
// post-login redirect never lands on a forbidden page.
export const ROLE_ROUTES: Record<StaffRole, string[]> = {
  owner: ALL_ROUTES,
manager: [
    "/dashboard",
    "/pos",
    "/orders",
    "/products",
    "/categories",
    "/tables",
    "/kitchen",
    "/inventory",
    "/recipes",
    "/reports",
    "/accounting",
    "/loyalty",
    "/cashup",
    "/digital-menu",
    "/promotions",
    "/bills",
    "/settings",
    "/messages",
  ],
  cashier: ["/dashboard", "/pos", "/orders", "/bills"],
  kitchen: ["/dashboard", "/orders", "/kitchen"],
  waiter: ["/dashboard", "/pos", "/orders"],
};

export function canAccess(role: StaffRole, path: string, plan?: PlanName): boolean {
  if (!(ROLE_ROUTES[role]?.includes(path) ?? false)) return false;
  if (plan && !isRouteAllowedForPlan(path, plan)) return false;
  return true;
}

export function assertAccess(role: StaffRole, path: string, plan?: PlanName): void {
  if (!canAccess(role, path, plan)) redirect("/dashboard");
}
