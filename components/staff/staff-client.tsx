"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StaffRole } from "@/lib/types";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface StaffRow {
  id: string;
  user_id: string;
  role: StaffRole;
  is_active: boolean;
  user_email: string;
  user_name: string;
  created_at: string;
}

const roleBadge: Record<StaffRole, { label: string; className: string }> = {
  owner: { label: "Owner", className: "bg-primary text-primary-foreground" },
  manager: { label: "Manager", className: "" },
  cashier: { label: "Cashier", className: "" },
  kitchen: { label: "Kitchen", className: "" },
  waiter: { label: "Waiter", className: "" },
};

function AddStaffDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("cashier");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !password) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("add_staff", {
      email: email.trim(),
      full_name: fullName.trim(),
      password,
      role,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Staff member added");
    router.refresh();
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
          <DialogDescription>
            Create their account from here â€” staff log in with the details you
            set. They don&apos;t need to sign up themselves.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-name">Full name</Label>
            <Input
              id="staff-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Mary Kila"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="waiter@kaipos.pg"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-password">Password</Label>
            <Input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole((v ?? "cashier") as StaffRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="cashier">Cashier</SelectItem>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="waiter">Waiter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Addingâ€¦" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffClient({
  staff,
  currentRole,
  currentUserId,
}: {
  staff: StaffRow[];
  currentRole: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<StaffRow[]>(staff);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOwner = currentRole === "owner";

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: s } = await supabase.from("staff").select("*");
    if (!s) return;
    const { data: u } = await supabase
      .from("users")
      .select("*")
      .in("id", s.map((x) => x.user_id) as string[]);
    const userById = new Map((u ?? []).map((x) => [x.id, x]));
    setRows(
      (s as unknown as StaffRow[]).map((x) => ({
        ...x,
        user_email: userById.get(x.user_id)?.email ?? "",
        user_name: userById.get(x.user_id)?.full_name ?? "",
      }))
    );
  }, []);

  async function updateRole(row: StaffRow, role: StaffRole) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_staff", {
      staff_id: row.id,
      role,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Role updated");
    router.refresh();
    await reload();
  }

  async function toggleActive(row: StaffRow) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_staff", {
      staff_id: row.id,
      is_active: !row.is_active,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(row.is_active ? "Member deactivated" : "Member activated");
    router.refresh();
    await reload();
  }

  async function remove(row: StaffRow) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("remove_staff", { staff_id: row.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Member removed");
    router.refresh();
    await reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Staff
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "Manage your team and their roles."
              : "View your team."}
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setAdding(true)}>
            <UserPlus />
            Add staff
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {isOwner && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isOwner ? 5 : 4}
                  className="py-10 text-center text-muted-foreground"
                >
                  No staff yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const badge = roleBadge[r.role] ?? roleBadge.cashier;
                const isSelf = r.user_id === currentUserId;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {r.user_name || "Unnamed"}
                        {r.role === "owner" && (
                          <ShieldCheck className="size-4 text-primary" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{r.user_email}</TableCell>
                    <TableCell>
                      {isOwner && !isSelf && r.role !== "owner" ? (
                        <Select
                          value={r.role}
                          onValueChange={(v) => void updateRole(r, (v ?? "cashier") as StaffRole)}
                          disabled={busy}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="cashier">Cashier</SelectItem>
                            <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="waiter">Waiter</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "default" : "secondary"}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        {!isSelf && r.role !== "owner" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => void toggleActive(r)}
                            >
                              {r.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={busy}
                              onClick={() => void remove(r)}
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {adding && (
        <AddStaffDialog
          onClose={() => setAdding(false)}
          onDone={() => setAdding(false)}
        />
      )}
    </div>
  );
}
