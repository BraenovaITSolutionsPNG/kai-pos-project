"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, PackagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import type {
  Ingredient,
  InventoryTransaction,
  Product,
  Recipe,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function IngredientForm({
  initial,
  restaurantId,
  onSaved,
  onCancel,
}: {
  initial?: Ingredient;
  restaurantId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    unit: initial?.unit ?? "each",
    current_stock: initial ? String(initial.current_stock) : "0",
    reorder_level: initial ? String(initial.reorder_level) : "0",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const payload = {
      name: values.name.trim(),
      unit: values.unit,
      current_stock: Number(values.current_stock) || 0,
      reorder_level: Number(values.reorder_level) || 0,
    };

    if (initial) {
      const { error } = await supabase
        .from("ingredients")
        .update(payload)
        .eq("id", initial.id);
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      toast.success("Ingredient updated");
    } else {
      const { error } = await supabase
        .from("ingredients")
        .insert({ restaurant_id: restaurantId, ...payload });
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      toast.success("Ingredient added");
    }
    setBusy(false);
    router.refresh();
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ing-name">Name</Label>
        <Input
          id="ing-name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="e.g. Chicken thigh"
          required
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="ing-unit">Unit</Label>
          <Input
            id="ing-unit"
            value={values.unit}
            onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
            placeholder="kg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ing-stock">Stock on hand</Label>
          <Input
            id="ing-stock"
            type="number"
            step="0.001"
            value={values.current_stock}
            onChange={(e) =>
              setValues((v) => ({ ...v, current_stock: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ing-reorder">Reorder at</Label>
          <Input
            id="ing-reorder"
            type="number"
            step="0.001"
            value={values.reorder_level}
            onChange={(e) =>
              setValues((v) => ({ ...v, reorder_level: e.target.value }))
            }
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Add ingredient"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function StockDialog({
  ingredient,
  mode,
  onClose,
  onDone,
}: {
  ingredient: Ingredient;
  mode: "restock" | "adjust";
  onClose: () => void;
  onDone: () => void;
}) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!qty || Number(qty) < 0) return;
    setBusy(true);
    const supabase = createClient();
    const { error } =
      mode === "restock"
        ? await supabase.rpc("restock_ingredient", {
            ingredient_id: ingredient.id,
            quantity: Number(qty),
          })
        : await supabase.rpc("adjust_ingredient", {
            ingredient_id: ingredient.id,
            quantity: Number(qty),
            note: note.trim() || undefined,
          });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(mode === "restock" ? "Stock restocked" : "Stock adjusted");
    router.refresh();
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "restock" ? "Restock" : "Adjust"} {ingredient.name}</DialogTitle>
          <DialogDescription>
            Current stock: {ingredient.current_stock} {ingredient.unit}.
            {mode === "restock"
              ? " Enter the amount being received."
              : " Enter the new stock-on-hand value."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stock-qty">
              {mode === "restock" ? "Amount to add" : "New stock level"} ({ingredient.unit})
            </Label>
            <Input
              id="stock-qty"
              type="number"
              step="0.001"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              required
            />
          </div>
          {mode === "adjust" && (
            <div className="space-y-2">
              <Label htmlFor="stock-note">Note</Label>
              <Input
                id="stock-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Stock take"
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecipeEditor({
  products,
  ingredients,
  recipes,
  onClose,
}: {
  products: Product[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [rows, setRows] = useState<Recipe[]>([]);
  const [selIngredient, setSelIngredient] = useState("");
  const [selQty, setSelQty] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows(recipes.filter((r) => r.product_id === productId));
  }, [productId, recipes]);

  async function addRow() {
    if (!productId || !selIngredient || !selQty) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("recipes").insert({
      restaurant_id: "",
      product_id: productId,
      ingredient_id: selIngredient,
      quantity_required: Number(selQty),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Recipe item added");
    router.refresh();
    setSelIngredient("");
    setSelQty("");
  }

  async function removeRow(row: Recipe) {
    const supabase = createClient();
    const { error } = await supabase.from("recipes").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Recipe item removed");
    router.refresh();
  }

  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recipes</DialogTitle>
          <DialogDescription>
            Which ingredients make up each product. Stock is deducted automatically on sale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={(v) => setProductId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {productId && (
            <>
              <div className="space-y-2">
                {rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted-foreground">
                    No ingredients yet for this product.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            {ingredientById.get(r.ingredient_id)?.name ?? r.ingredient_id}
                          </TableCell>
                          <TableCell>
                            {r.quantity_required}{" "}
                            {ingredientById.get(r.ingredient_id)?.unit ?? ""}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void removeRow(r)}
                            >
                              <Trash2 />
                              <span className="sr-only">Remove</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Ingredient</Label>
                  <Select
                    value={selIngredient}
                    onValueChange={(v) => setSelIngredient(v ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select ingredient" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} ({i.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-2">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={selQty}
                    onChange={(e) => setSelQty(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <Button onClick={() => void addRow()} disabled={busy}>
                  <Plus />
                  Add
                </Button>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryClient({
  restaurantId,
  ingredients,
  recipes,
  transactions,
  products,
}: {
  restaurantId: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
  transactions: InventoryTransaction[];
  products: Product[];
}) {
  const [items, setItems] = useState<Ingredient[]>(ingredients);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState<Ingredient | null>(null);
  const [stockAction, setStockAction] = useState<{
    ingredient: Ingredient;
    mode: "restock" | "adjust";
  } | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("ingredients").select("*").order("name");
    if (data) setItems(data as unknown as Ingredient[]);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function confirmDelete() {
    if (!deleting) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("ingredients")
      .delete()
      .eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ingredient deleted");
    setDeleting(null);
    await reload();
  }

  const lowStock = items.filter(
    (i) => i.reorder_level > 0 && i.current_stock <= i.reorder_level
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            Track ingredients and stock levels.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRecipeOpen(true)}>
            Recipes
          </Button>
          <Dialog open={adding} onOpenChange={setAdding}>
            <DialogTrigger
              render={
                <Button>
                  <Plus />
                  Add ingredient
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add ingredient</DialogTitle>
                <DialogDescription>
                  Add an ingredient you track in stock.
                </DialogDescription>
              </DialogHeader>
              <IngredientForm
                restaurantId={restaurantId}
                onSaved={() => {
                  setAdding(false);
                  void reload();
                }}
                onCancel={() => setAdding(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">Low stock alert</p>
            <p className="text-sm">
              {lowStock.map((i) => `${i.name} (${i.current_stock}/${i.reorder_level})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="ingredients">
        <TabsList>
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="movements">Stock movements</TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Stock on hand</TableHead>
                  <TableHead>Reorder at</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No ingredients yet, add your first ingredient.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell>{i.unit}</TableCell>
                      <TableCell>{i.current_stock}</TableCell>
                      <TableCell>{i.reorder_level}</TableCell>
                      <TableCell>
                        {i.reorder_level > 0 && i.current_stock <= i.reorder_level ? (
                          <Badge variant="destructive">Low</Badge>
                        ) : i.current_stock === 0 ? (
                          <Badge variant="secondary">Out</Badge>
                        ) : (
                          <Badge>In stock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setStockAction({ ingredient: i, mode: "restock" })
                          }
                        >
                          <PackagePlus />
                          <span className="sr-only">Restock</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(i)}
                        >
                          <Pencil />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(i)}
                        >
                          <Trash2 />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="movements">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No stock movements yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t) => {
                    const ing = ingredients.find((i) => i.id === t.ingredient_id);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>{formatDateTime(t.created_at)}</TableCell>
                        <TableCell>{ing?.name ?? t.ingredient_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.type}</Badge>
                        </TableCell>
                        <TableCell
                          className={t.quantity >= 0 ? "text-green-600" : "text-red-600"}
                        >
                          {t.quantity >= 0 ? "+" : ""}
                          {t.quantity} {ing?.unit ?? ""}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.reference ?? ""}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {stockAction && (
        <StockDialog
          ingredient={stockAction.ingredient}
          mode={stockAction.mode}
          onClose={() => setStockAction(null)}
          onDone={() => {
            setStockAction(null);
            void reload();
          }}
        />
      )}

      {recipeOpen && (
        <RecipeEditor
          products={products}
          ingredients={items}
          recipes={recipes}
          onClose={() => setRecipeOpen(false)}
        />
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit ingredient</DialogTitle>
          </DialogHeader>
          {editing && (
            <IngredientForm
              initial={editing}
              restaurantId={restaurantId}
              onSaved={() => {
                setEditing(null);
                void reload();
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete ingredient?</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” and its recipes will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}