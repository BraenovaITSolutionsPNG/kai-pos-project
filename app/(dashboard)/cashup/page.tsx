import type { Metadata } from "next";
import { CashupClient } from "@/components/cashup/cashup-client";
import {
  getSessionContext,
  getShifts,
  getExpenses,
} from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Cashup",
};

export default async function CashupPage() {
  const [ctx, shifts, expenses] = await Promise.all([
    getSessionContext(),
    getShifts(),
    getExpenses(),
  ]);
  assertAccess(ctx.staff.role, "/cashup");

  return (
    <CashupClient
      restaurantId={ctx.restaurant.id}
      restaurantName={ctx.restaurant.name}
      shifts={shifts}
      expenses={expenses}
      userId={ctx.user.id}
      userRole={ctx.staff.role}
    />
  );
}