"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AdminBusinessRow } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function BusinessesClient({
  businesses,
}: {
  businesses: AdminBusinessRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AdminBusinessRow[]>(businesses);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBusinessRow | null>(null);

  async function updateBusiness(
    id: string,
    payload: { plan?: AdminBusinessRow["plan"]; is_active?: boolean }
  ) {
    setBusyId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("businesses")
      .update(payload)
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...payload } : b))
    );
    toast.success("Business updated");
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    const supabase = createClient();
    const { error, count } = await supabase
      .from("businesses")
      .delete({ count: "exact" })
      .eq("id", target.id);
    setBusyId(null);
    setDeleteTarget(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (count === 0) {
      toast.error("Delete blocked - you may not have admin permissions. Try logging out and back in.");
      return;
    }
    setRows((prev) => prev.filter((b) => b.id !== target.id));
    toast.success("Business deleted");
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Businesses
        </h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} business(es) on the platform. Change plans or suspend
          accounts here.
        </p>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Restaurants</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No businesses yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" />
                      {b.name}
                    </span>
                  </TableCell>
                  <TableCell>{b.owner_email ?? "-"}</TableCell>
                  <TableCell>{b.restaurant_count}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {b.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.is_active ? "default" : "destructive"}>
                      {b.is_active ? "Active" : "Suspended"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === b.id}
                        className={b.is_active ? "text-destructive" : ""}
                        onClick={() =>
                          void updateBusiness(b.id, {
                            is_active: !b.is_active,
                          })
                        }
                      >
                        {b.is_active ? "Suspend" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === b.id}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(b)}
                        title="Delete business"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Suspended businesses can&apos;t sign in until reactivated. Deleting a
        business permanently removes it and all associated data.
      </p>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete business</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This will permanently remove the business, all its restaurants,
              products, orders, and subscription payments. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={busyId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={busyId !== null}
            >
              {busyId !== null ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
