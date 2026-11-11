"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function ResetDataButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (confirmText.trim().toUpperCase() !== "RESET") {
      toast.error('Please type "RESET" to confirm.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Resetting platform test data...");

    try {
      const res = await fetch("/api/admin/clear-data", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to reset test data.");
      }

      toast.success(data.message || "All test data successfully reset!", {
        id: toastId,
      });

      setOpen(false);
      setConfirmText("");

      // Refresh data
      router.refresh();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error resetting data", {
        id: toastId,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30">
            <Trash2 className="mr-2 size-4" />
            Reset test data
          </Button>
        }
      />
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            <DialogTitle>Reset All Test Data</DialogTitle>
          </div>
          <DialogDescription className="space-y-2 pt-2">
            <span>
              This will permanently delete all <strong>businesses</strong>,{" "}
              <strong>restaurants</strong>, <strong>menus</strong>,{" "}
              <strong>orders</strong>, <strong>tables</strong>, and{" "}
              <strong>test accounts</strong> from the database.
            </span>
            <span className="block font-medium text-foreground">
              Platform administrator accounts will NOT be deleted.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label className="text-xs font-medium text-muted-foreground">
            Type <span className="font-bold text-destructive">RESET</span> below to confirm:
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
            disabled={loading}
            className="uppercase"
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setConfirmText("");
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={loading || confirmText.trim().toUpperCase() !== "RESET"}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Confirm Reset"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

