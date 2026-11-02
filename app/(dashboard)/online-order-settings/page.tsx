import type { Metadata } from "next";
import { OnlineOrderSettingsClient } from "@/components/online-order-settings/online-order-settings-client";
import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";
import { isRouteAllowedForPlan } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Online Ordering",
};

export default async function OnlineOrderSettingsPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/online-order-settings");

  if (!isRouteAllowedForPlan("/online-order-settings", ctx.business.plan)) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Online Ordering
        </h1>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
          <p className="text-amber-800 font-medium">
            Online ordering is available on Business and Professional plans.
          </p>
          <p className="text-sm text-amber-700 mt-2">
            Upgrade your plan to enable online ordering for your customers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <OnlineOrderSettingsClient
      restaurantId={ctx.restaurant.id}
      restaurantName={ctx.restaurant.name}
    />
  );
}

