import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";
import type { PlanName } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { PromotionsClient } from "@/components/menu/promotions-client";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const ctx = await getSessionContext();
  // Owners and managers may manage promotions; digital menu is Business/Pro only.
  assertAccess(ctx.staff.role, "/promotions", ctx.business?.plan as PlanName);

  const supabase = await createClient();
  const { data } = await supabase
    .from("promotions")
    .select("*")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("sort_order");

  return (
    <PromotionsClient
      restaurantId={ctx.restaurant.id}
      initialPromotions={(data as unknown as never[]) ?? []}
    />
  );
}
