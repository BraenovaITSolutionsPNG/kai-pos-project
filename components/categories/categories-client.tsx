"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function CategoryForm({
  initial,
  restaurantId,
  onSaved,
  onCancel,
}: {
  initial?: Category;
  restaurantId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const supabase = createClient();

    if (initial) {
      const { error } = await supabase
        .from("categories")
        .update({ name: name.trim(), sort_order: Number(sortOrder) || 0 })
        .eq("id", initial.id);
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      toast.success("Category updated");
    } else {
      const { error } = await supabase.from("categories").insert({
        restaurant_id: restaurantId,
        name: name.trim(),
        sort_order: Number(sortOrder) || 0,
      });
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      toast.success("Category created");
    }
    setBusy(false);
    router.refresh();
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category-name">Name</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Drinks"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category-sort">Sort order</Label>
        <Input
          id="category-sort"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Add category"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CategoriesClient({
  categories,
  productCounts,
  restaurantId,
}: {
  categories: Category[];
  productCounts: Record<string, number>;
  restaurantId: string;
}) {
  const [cats, setCats] = useState<Category[]>(categories);
  const [counts, setCounts] = useState<Record<string, number>>(productCounts);
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    if (rows) {
      setCats(rows as unknown as Category[]);
      const { data: prods } = await supabase.from("products").select("category_id");
      if (prods) {
        const next: Record<string, number> = {};
        for (const p of prods as unknown as { category_id: string | null }[]) {
          if (p.category_id) next[p.category_id] = (next[p.category_id] ?? 0) + 1;
        }
        setCounts(next);
      }
    }
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
      .from("categories")
      .delete()
      .eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Category deleted");
    setDeleting(null);
    await reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Categories
          </h1>
          <p className="text-sm text-muted-foreground">
            Organise your menu. Categories appear as tabs on the POS screen.
          </p>
        </div>
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogTrigger
            render={
              <Button>
                <Plus />
                Add category
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add category</DialogTitle>
              <DialogDescription>
                A new tab on your POS sales screen.
              </DialogDescription>
            </DialogHeader>
            <CategoryForm
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
              <TableHead>Sort order</TableHead>
              <TableHead>Products</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No categories yet, add your first one.
                </TableCell>
              </TableRow>
            ) : (
              cats.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.sort_order}</TableCell>
                  <TableCell>{counts[c.id] ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(c)}
                    >
                      <Pencil />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(c)}
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
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          {editing && (
            <CategoryForm
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
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” will be removed. Products in this category are
              kept but left uncategorised.
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