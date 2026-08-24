import type { Metadata } from "next";
import { CashupClient } from "@/components/cashup/cashup-client";
import {
  getSessionContext,
  getShifts,
  getExpenses,
  getShiftSchedules,
  getStaffOptions,
} from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Cashup",
};

export default async function CashupPage() {
  const [ctx, shifts, expenses, shiftSchedules, staffOptions] = await Promise.all([
    getSessionContext(),
    getShifts(),
    getExpenses(),
    getShiftSchedules(),
    getStaffOptions(),
  ]);
  assertAccess(ctx.staff.role, "/cashup");

  return (
    <CashupClient
      restaurantId={ctx.restaurant.id}
      restaurantName={ctx.restaurant.name}
      shifts={shifts}
      expenses={expenses}
      shiftSchedules={shiftSchedules}
      staffOptions={staffOptions}
      userId={ctx.user.id}
      userRole={ctx.staff.role}
      userStaffId={ctx.staff.id}
    />
  );
}