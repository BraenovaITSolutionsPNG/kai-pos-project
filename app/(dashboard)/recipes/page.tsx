import type { Metadata } from "next";
import { RecipesClient } from "@/components/recipes/recipes-client";
import {
  getAllProducts,
  getIngredients,
  getRecipes,
  getSessionContext,
} from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Recipes",
};

export default async function RecipesPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/recipes");

  const [ingredients, recipes, products] = await Promise.all([
    getIngredients(),
    getRecipes(),
    getAllProducts(),
  ]);

  return (
    <RecipesClient
      restaurantId={ctx.restaurant.id}
      ingredients={ingredients}
      recipes={recipes}
      products={products}
    />
  );
}
