import type { Metadata } from "next";
import { ReportsClient } from "@/components/reports/reports-client";
import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Reports",
};

export default async function ReportsPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/reports");

  return <ReportsClient />;
}