import type { Metadata } from "next";
import { getOrders, getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";
import { OrdersClient } from "@/components/orders/orders-client";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function OrdersPage({
  searchParams,
}: PageProps<"/orders">) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";

  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/orders");

  const orders = await getOrders(from || undefined, to || undefined);

  return <OrdersClient initialOrders={orders} from={from} to={to} />;
}
