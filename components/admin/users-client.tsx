"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AdminUserRow } from "@/lib/queries";
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

export function UsersClient({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<AdminUserRow[]>(users);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleAdmin(id: string, current: boolean) {
    setBusyId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ is_platform_admin: !current })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) =>
      prev.map((u) => (u.id === id ? { ...u, is_platform_admin: !current } : u))
    );
    toast.success(!current ? "Promoted to platform admin" : "Admin rights removed");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Users
        </h1>
        <p className="text-sm text-muted-foreground">
          Everyone with an account on the platform.
        </p>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Business memberships</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {u.full_name || "Unnamed"}
                      {u.is_platform_admin && (
                        <ShieldCheck className="size-4 text-primary" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="max-w-64">
                    {u.memberships ? (
                      <span className="text-sm">{u.memberships}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No restaurant access
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.is_platform_admin ? (
                      <Badge className="bg-primary text-primary-foreground">
                        Platform admin
                      </Badge>
                    ) : (
                      <Badge variant="outline">User</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === u.id}
                      onClick={() => void toggleAdmin(u.id, u.is_platform_admin)}
                    >
                      {u.is_platform_admin
                        ? "Remove admin"
                        : "Make admin"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}