"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
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
import { toast } from "sonner";

export function BusinessesClient({
  businesses,
}: {
  businesses: AdminBusinessRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AdminBusinessRow[]>(businesses);
  const [busyId, setBusyId] = useState<string | null>(null);

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
                  <TableCell>{b.owner_email ?? "—"}</TableCell>
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Suspended businesses can&apos;t sign in until reactivated.
      </p>
    </div>
  );
}