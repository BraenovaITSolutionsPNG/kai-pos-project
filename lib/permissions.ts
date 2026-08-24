import { redirect } from "next/navigation";
import type { StaffRole } from "@/lib/types";

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
  "/reports",
  "/cashup",
  "/staff",
  "/digital-menu",
  "/bills",
  "/settings",
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
    "/reports",
    "/cashup",
    "/digital-menu",
    "/bills",
    "/settings",
  ],
  cashier: ["/dashboard", "/pos", "/orders", "/bills"],
  kitchen: ["/dashboard", "/orders", "/kitchen"],
  waiter: ["/dashboard", "/pos", "/orders"],
};

export function canAccess(role: StaffRole, path: string): boolean {
  return ROLE_ROUTES[role]?.includes(path) ?? false;
}

export function assertAccess(role: StaffRole, path: string): void {
  if (!canAccess(role, path)) redirect("/dashboard");
}
