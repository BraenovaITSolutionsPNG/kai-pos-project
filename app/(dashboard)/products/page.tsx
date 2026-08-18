import type { Metadata } from "next";
import { ProductsClient } from "@/components/products/products-client";
import { getAllProducts, getCategories, getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Products",
};

export default async function ProductsPage() {
  const [ctx, products, categories] = await Promise.all([
    getSessionContext(),
    getAllProducts(),
    getCategories(),
  ]);
  assertAccess(ctx.staff.role, "/products");

  return (
    <ProductsClient
      products={products}
      categories={categories}
      restaurantId={ctx.restaurant.id}
    />
  );
}