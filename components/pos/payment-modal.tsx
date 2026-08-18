"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatKina, PAYMENT_METHODS, paymentMethodLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/types";

export function PaymentModal({
  open,
  onOpenChange,
  total,
  pending,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  pending: boolean;
  onComplete: (method: PaymentMethod) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Total due today:{" "}
            <span className="font-semibold text-foreground">
              {formatKina(total)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                method === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent"
              )}
            >
              {paymentMethodLabel(m)}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onComplete(method)}
            disabled={pending || total <= 0}
            className="min-w-32"
          >
            {pending ? "Processing…" : "Complete sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}