import type { Metadata } from "next";
import { LoyaltyClient } from "@/components/loyalty/loyalty-client";
import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Loyalty Program",
};

export default async function LoyaltyPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/loyalty");

  return <LoyaltyClient restaurantId={ctx.restaurant.id} />;
}