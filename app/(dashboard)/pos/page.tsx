import type { Metadata } from "next";
import { PosClient } from "@/components/pos/pos-client";
import { getCategories, getProducts, getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "POS",
};

export default async function PosPage() {
  const [ctx, categories, products] = await Promise.all([
    getSessionContext(),
    getCategories(),
    getProducts(),
  ]);
  assertAccess(ctx.staff.role, "/pos");

  return (
    <PosClient
      categories={categories}
      products={products}
      restaurantId={ctx.restaurant.id}
      restaurantName={ctx.restaurant.name}
      restaurantAddress={ctx.restaurant.address}
      taxRate={Number(ctx.restaurant.tax_rate)}
      createdBy={ctx.user.id}
    />
  );
}