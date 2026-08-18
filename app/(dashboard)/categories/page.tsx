import type { Metadata } from "next";
import { CategoriesClient } from "@/components/categories/categories-client";
import { getCategories, getSessionContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Categories",
};

export default async function CategoriesPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/categories");
  const categories = await getCategories();
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("category_id")
    .eq("restaurant_id", ctx.restaurant.id);

  const counts: Record<string, number> = {};
  for (const p of (products ?? []) as { category_id: string | null }[]) {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  }

  return (
    <CategoriesClient
      categories={categories}
      productCounts={counts}
      restaurantId={ctx.restaurant.id}
    />
  );
}