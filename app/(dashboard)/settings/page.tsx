import type { Metadata } from "next";
import { SettingsClient } from "@/components/settings/settings-client";
import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/settings");

  return (
    <SettingsClient
      businessName={ctx.business.name}
      plan={ctx.business.plan}
      restaurantId={ctx.restaurant.id}
      restaurantName={ctx.restaurant.name}
      address={ctx.restaurant.address}
      currency={ctx.restaurant.currency}
      taxRate={Number(ctx.restaurant.tax_rate)}
    />
  );
}