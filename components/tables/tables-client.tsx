"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DiningTable, TableStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const statusStyles: Record<TableStatus, { dot: string; label: string; ring: string }> = {
  available: { dot: "bg-green-500", label: "Available", ring: "ring-green-500/40" },
  occupied: { dot: "bg-red-500", label: "Occupied", ring: "ring-red-500/40" },
  reserved: { dot: "bg-amber-500", label: "Reserved", ring: "ring-amber-500/40" },
};

function TableForm({
  initial,
  restaurantId,
  onSaved,
  onCancel,
}: {
  initial?: DiningTable;
  restaurantId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    label: initial?.label ?? "",
    capacity: String(initial?.capacity ?? 4),
    status: (initial?.status ?? "available") as TableStatus,
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.label.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const payload = {
      label: values.label.trim(),
      capacity: Number(values.capacity) || 4,
      status: values.status,
    };

    if (initial) {
      const { error } = await supabase
        .from("tables")
        .update(payload)
        .eq("id", initial.id);
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      toast.success("Table updated");
    } else {
      const { error } = await supabase
        .from("tables")
        .insert({ restaurant_id: restaurantId, ...payload });
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      toast.success("Table added");
    }
    setBusy(false);
    router.refresh();
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="table-label">Table label</Label>
        <Input
          id="table-label"
          value={values.label}
          onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
          placeholder="e.g. T1"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="table-capacity">Seats</Label>
          <Input
            id="table-capacity"
            type="number"
            min="1"
            value={values.capacity}
            onChange={(e) =>
              setValues((v) => ({ ...v, capacity: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={values.status}
            onValueChange={(value) =>
              setValues((v) => ({ ...v, status: (value ?? "available") as TableStatus }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Add table"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TablesClient({
  tables,
  restaurantId,
}: {
  tables: DiningTable[];
  restaurantId: string;
}) {
  const [items, setItems] = useState<DiningTable[]>(tables);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const [deleting, setDeleting] = useState<DiningTable | null>(null);
  const [flipping, setFlipping] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("tables").select("*").order("label");
    if (data) setItems(data as unknown as DiningTable[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("tables").select("*").order("label");
      if (!cancelled && data) setItems(data as unknown as DiningTable[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function flipStatus(table: DiningTable) {
    setFlipping(table.id);
    const supabase = createClient();
    const next: TableStatus =
      table.status === "available" ? "occupied" : "available";
    const { error } = await supabase
      .from("tables")
      .update({ status: next })
      .eq("id", table.id);
    setFlipping(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${table.label} → ${statusStyles[next].label}`);
    await reload();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const supabase = createClient();
    const { error } = await supabase.from("tables").delete().eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Table deleted");
    setDeleting(null);
    await reload();
  }

  const occupied = items.filter((t) => t.status !== "available").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Tables
          </h1>
          <p className="text-sm text-muted-foreground">
            Your floor plan. {occupied} of {items.length} tables in use.
          </p>
        </div>
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogTrigger
            render={
              <Button>
                <Plus />
                Add table
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add table</DialogTitle>
              <DialogDescription>
                Add a table to your floor plan.
              </DialogDescription>
            </DialogHeader>
            <TableForm
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

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-12 text-center text-muted-foreground">
          No tables yet, add your first table to build the floor plan.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((t) => {
            const style = statusStyles[t.status];
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => flipStatus(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void flipStatus(t);
                  }
                }}
                className={cn(
                  "group cursor-pointer rounded-xl border bg-card p-4 text-left shadow-sm ring-2 transition hover:shadow-md",
                  style.ring
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-lg font-semibold">
                    {t.label}
                  </span>
                  <span
                    className={cn("size-2.5 rounded-full", style.dot)}
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.capacity} seats
                </p>
                <div className="mt-3 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(t);
                    }}
                  >
                    <Pencil />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(t);
                    }}
                  >
                    <Trash2 />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-green-500" /> Available
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-500" /> Occupied
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-amber-500" /> Reserved
        </span>
        <span className="ml-auto">Tap a table to toggle Available / Occupied</span>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit table</DialogTitle>
          </DialogHeader>
          {editing && (
            <TableForm
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
            <DialogTitle>Delete table?</DialogTitle>
            <DialogDescription>
              “{deleting?.label}” will be removed from the floor plan.
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