import type { Metadata } from "next";
import { OnlineOrderSettingsClient } from "@/components/online-order-settings/online-order-settings-client";
import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Online Ordering",
};

export default async function OnlineOrderSettingsPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/settings");

  return (
    <OnlineOrderSettingsClient
      restaurantId={ctx.restaurant.id}
      restaurantName={ctx.restaurant.name}
    />
  );
}

