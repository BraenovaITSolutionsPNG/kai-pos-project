"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatKina } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ProductFormValues {
  name: string;
  price: string;
  categoryId: string;
  sortOrder: string;
  isActive: boolean;
  imageUrl: string;
}

function ProductForm({
  initial,
  categories,
  restaurantId,
  onSaved,
  onCancel,
}: {
  initial?: Product;
  categories: Category[];
  restaurantId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({
    name: initial?.name ?? "",
    price: initial ? String(initial.price) : "",
    categoryId: initial?.category_id ?? categories[0]?.id ?? "",
    sortOrder: String(initial?.sort_order ?? 0),
    isActive: initial?.is_active ?? true,
    imageUrl: initial?.image_url ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function set<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim() || Number(values.price) < 0) return;
    setBusy(true);
    const supabase = createClient();

    let imageUrl = values.imageUrl;
    if (pendingFile) {
      const fd = new FormData();
      fd.append("file", pendingFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as {
        data?: { url: string };
        error?: { message: string } | null;
      };
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Image upload failed");
        setBusy(false);
        return;
      }
      imageUrl = json.data!.url;
    }

    const payload = {
      name: values.name.trim(),
      price: Number(values.price),
      category_id: values.categoryId || null,
      sort_order: Number(values.sortOrder) || 0,
      is_active: values.isActive,
      image_url: imageUrl || null,
    };

    if (initial) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", initial.id);
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      toast.success("Product updated");
    } else {
      const { error } = await supabase
        .from("products")
        .insert({ restaurant_id: restaurantId, ...payload });
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      toast.success("Product added");
    }
    setBusy(false);
    router.refresh();
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="product-name">Name</Label>
        <Input
          id="product-name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Chicken Fried Rice"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="product-price">Price (Kina)</Label>
          <Input
            id="product-price"
            type="number"
            step="0.01"
            min="0"
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="25.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={values.categoryId}
            onValueChange={(value) => set("categoryId", value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  Create a category first.
                </p>
              )}
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="product-sort">Sort order</Label>
          <Input
            id="product-sort"
            type="number"
            value={values.sortOrder}
            onChange={(e) => set("sortOrder", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-image">Image (optional)</Label>
          <Input
            id="product-image"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (preview) URL.revokeObjectURL(preview);
              setPendingFile(file);
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Product preview"
              className="h-20 w-20 rounded-lg border object-cover"
            />
          ) : values.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={values.imageUrl}
              alt={values.name}
              className="h-20 w-20 rounded-lg border object-cover"
            />
          ) : null}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="size-4 rounded border-input accent-foreground"
        />
        Visible on the POS screen
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Add product"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProductsClient({
  products,
  categories,
  restaurantId,
}: {
  products: Product[];
  categories: Category[];
  restaurantId: string;
}) {
  const [items, setItems] = useState<Product[]>(products);
  const [cats, setCats] = useState<Category[]>(categories);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: prods } = await supabase
      .from("products")
      .select("*")
      .order("sort_order");
    const { data: categoryRows } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    if (prods) setItems(prods as unknown as Product[]);
    if (categoryRows) setCats(categoryRows as unknown as Category[]);
  }, []);

  // Keep the list in sync with the demo store (or the DB) after mount.
  useEffect(() => {
    // setState happens after an async fetch inside reload, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function confirmDelete() {
    if (!deleting) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Product deleted");
    setDeleting(null);
    await reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Products
          </h1>
          <p className="text-sm text-muted-foreground">
            Your menu items, shown on the POS screen.
          </p>
        </div>
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogTrigger
            render={
              <Button>
                <Plus />
                Add product
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add product</DialogTitle>
              <DialogDescription>
                Add a menu item and set its Kina price.
              </DialogDescription>
            </DialogHeader>
            <ProductForm
              categories={cats}
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

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No products yet, add your first menu item.
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    {p.category_name ??
                      cats.find((c) => c.id === p.category_id)?.name ??
                      "Uncategorised"}
                  </TableCell>
                  <TableCell>{formatKina(Number(p.price))}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Active" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(p)}
                    >
                      <Pencil />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(p)}
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

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>
          {editing && (
            <ProductForm
              initial={editing}
              categories={cats}
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
            <DialogTitle>Delete product?</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” will be removed from your menu.
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