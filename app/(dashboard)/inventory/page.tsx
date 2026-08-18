import type { Metadata } from "next";
import { InventoryClient } from "@/components/inventory/inventory-client";
import {
  getAllProducts,
  getIngredients,
  getInventoryTransactions,
  getRecipes,
  getSessionContext,
} from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Inventory",
};

export default async function InventoryPage() {
  const [ctx, ingredients, recipes, transactions, products] = await Promise.all([
    getSessionContext(),
    getIngredients(),
    getRecipes(),
    getInventoryTransactions(),
    getAllProducts(),
  ]);
  assertAccess(ctx.staff.role, "/inventory");

  return (
    <InventoryClient
      restaurantId={ctx.restaurant.id}
      ingredients={ingredients}
      recipes={recipes}
      transactions={transactions}
      products={products}
    />
  );
}