"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrdersFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();

  function clear() {
    router.replace("/orders");
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
      <div className="space-y-1">
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          type="date"
          value={from}
          onChange={(e) =>
            router.replace(
              `/orders?from=${e.target.value}${to ? `&to=${to}` : ""}`
            )
          }
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="date"
          value={to}
          onChange={(e) =>
            router.replace(
              `/orders?${from ? `from=${from}&` : ""}to=${e.target.value}`
            )
          }
          className="w-40"
        />
      </div>
      <Button variant="outline" onClick={clear}>
        Clear
      </Button>
    </div>
  );
}