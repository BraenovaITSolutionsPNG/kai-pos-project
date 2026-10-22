import type { Metadata } from "next";
import { OwnerClient } from "@/components/owner/owner-client";
import { getSessionContext, getBusinessRestaurants } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Owner Dashboard",
};

export default async function OwnerPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/owner");

  const restaurants = await getBusinessRestaurants();

  return <OwnerClient businessName={ctx.business.name} initialRestaurants={restaurants} />;
}