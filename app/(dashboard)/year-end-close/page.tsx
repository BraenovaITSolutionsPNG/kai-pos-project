import type { Metadata } from "next";
import { YearEndCloseClient } from "@/components/year-end-close/year-end-close-client";
import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Year-End Close",
};

export default async function YearEndClosePage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/settings");

  return (
    <YearEndCloseClient
      restaurantName={ctx.restaurant.name}
      userRole={ctx.staff.role}
    />
  );
}

