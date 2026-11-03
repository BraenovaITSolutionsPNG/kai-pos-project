"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, AlertTriangle, CheckCircle2 } from "lucide-react";

export function YearEndCloseClient({
  restaurantName,
  userRole,
}: {
  restaurantName: string;
  userRole: string;
}) {
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  if (userRole !== "owner") {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Year-End Close
        </h1>
        <p className="text-sm text-muted-foreground">
          Only owners can perform year-end close.
        </p>
      </div>
    );
  }

  async function handleClose() {
    if (confirm !== "CLOSE_YEAR") {
      toast.error("Type CLOSE_YEAR to confirm");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/year-end-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYear: Number(fiscalYear), confirm: "CLOSE_YEAR" }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast.success("Year-end close completed");
        // Download backup
        const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `backup-${restaurantName}-${fiscalYear}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (e) {
      toast.error("Failed to perform year-end close");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Year-End Close
        </h1>
        <p className="text-sm text-muted-foreground">
          Archive this year data and start fresh for {restaurantName}.
        </p>
      </div>

      <Card className="border-amber-300 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="size-5" />
            Important
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-800 space-y-2">
          <p>This will archive all transactional data (orders, payments, expenses, shifts, cashups, inventory transactions) for the fiscal year and reset the system for a new year.</p>
          <p>Your products, categories, settings, staff, and tables will be preserved.</p>
          <p>A backup JSON file will be downloaded automatically.</p>
          <p>This action cannot be undone.</p>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="size-5" />
              Year-End Close Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-green-800">
            <p>Orders archived: {result.summary.orders_archived}</p>
            <p>Expenses archived: {result.summary.expenses_archived}</p>
            <p>Shifts archived: {result.summary.shifts_archived}</p>
            <p>Cashups archived: {result.summary.cashups_archived}</p>
            <p>Inventory transactions archived: {result.summary.inventory_transactions_archived}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Perform Year-End Close</CardTitle>
          <CardDescription>
            Archive data for the specified fiscal year
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fiscalYear">Fiscal Year</Label>
            <Input
              id="fiscalYear"
              type="number"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Type CLOSE_YEAR to confirm</Label>
            <Input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="CLOSE_YEAR"
            />
          </div>
          <Button onClick={handleClose} disabled={busy || confirm !== "CLOSE_YEAR"} variant="destructive">
            {busy ? "Processing..." : "Perform Year-End Close"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

