import type { Metadata } from "next";
import { TablesClient } from "@/components/tables/tables-client";
import { getSessionContext, getTables } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Tables",
};

export default async function TablesPage() {
  const [ctx, tables] = await Promise.all([getSessionContext(), getTables()]);
  assertAccess(ctx.staff.role, "/tables");

  return (
    <TablesClient tables={tables} restaurantId={ctx.restaurant.id} />
  );
}