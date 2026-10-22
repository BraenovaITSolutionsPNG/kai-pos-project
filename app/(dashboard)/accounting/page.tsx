import type { Metadata } from "next";
import { AccountingClient } from "@/components/accounting/accounting-client";
import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Accounting Exports",
};

export default async function AccountingPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/accounting");

  return <AccountingClient restaurantId={ctx.restaurant.id} />;
}