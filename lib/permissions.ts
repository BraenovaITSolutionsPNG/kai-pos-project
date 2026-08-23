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
    "/settings",
  ],
  cashier: ["/dashboard", "/pos", "/orders"],
  kitchen: ["/dashboard", "/orders", "/kitchen"],
};

export function canAccess(role: StaffRole, path: string): boolean {
  return ROLE_ROUTES[role]?.includes(path) ?? false;
}

export function assertAccess(role: StaffRole, path: string): void {
  if (!canAccess(role, path)) redirect("/dashboard");
}
