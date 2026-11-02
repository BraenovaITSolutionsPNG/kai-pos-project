import type { Metadata } from "next";
import { ReservationsClient } from "@/components/reservations/reservations-client";
import { getSessionContext, getTables } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Reservations",
};

export default async function ReservationsPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/tables");

  const tables = await getTables();

  return (
    <ReservationsClient
      restaurantId={ctx.restaurant.id}
      tables={tables}
    />
  );
}

