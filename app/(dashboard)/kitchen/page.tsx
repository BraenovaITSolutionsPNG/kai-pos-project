import type { Metadata } from "next";
import { KitchenClient } from "@/components/kitchen/kitchen-client";
import { getKitchenOrders, getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Kitchen",
};

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/kitchen");

  const orders = await getKitchenOrders();

  return <KitchenClient initialOrders={orders} />;
}