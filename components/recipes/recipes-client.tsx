"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Ingredient, Product, Recipe } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RecipeEditor } from "@/components/inventory/inventory-client";

export function RecipesClient({
  restaurantId,
  products,
  ingredients,
  recipes,
}: {
  restaurantId: string;
  products: Product[];
  ingredients: Ingredient[];
  recipes: Recipe[];
}) {
  const [open, setOpen] = useState(false);

  const recipeCountByProduct = new Map<string, number>();
  for (const r of recipes) {
    recipeCountByProduct.set(
      r.product_id,
      (recipeCountByProduct.get(r.product_id) ?? 0) + 1
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Recipes
          </h1>
          <p className="text-sm text-muted-foreground">
            Link ingredients to products. Stock is deducted automatically on sale.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Manage recipes
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-medium">Product</th>
              <th className="px-4 py-3 text-left font-medium">Ingredients</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-muted-foreground">
                  No products yet.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {recipeCountByProduct.get(p.id) ?? 0} ingredient(s)
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <RecipeEditor
          restaurantId={restaurantId}
          products={products}
          ingredients={ingredients}
          recipes={recipes}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
