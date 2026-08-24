import { headers } from "next/headers";
import { getSessionContext, getTables } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";
import { DigitalMenuClient } from "@/components/menu/digital-menu-client";

export default async function DigitalMenuPage() {
  const [ctx, tables] = await Promise.all([
    getSessionContext(),
    getTables(),
  ]);
  assertAccess(ctx.staff.role, "/digital-menu");

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const baseUrl = `${origin}/menu/${ctx.restaurant.id}`;

  return (
    <DigitalMenuClient
      baseUrl={baseUrl}
      tables={tables}
      restaurantName={ctx.restaurant.name}
    />
  );
}