"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/supabase/env";
import { resetDemo } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export function SettingsClient({
  businessName,
  plan,
  restaurantId,
  restaurantName,
  address,
  currency,
  taxRate,
}: {
  businessName: string;
  plan: string;
  restaurantId: string;
  restaurantName: string;
  address: string | null;
  currency: string;
  taxRate: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(restaurantName);
  const [addr, setAddr] = useState(address ?? "");
  const [tax, setTax] = useState(String(taxRate));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("restaurants")
      .update({
        name: name.trim(),
        address: addr.trim() || null,
        tax_rate: Number(tax) || 0,
      })
      .eq("id", restaurantId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settings saved");
    router.refresh();
  }

  async function resetDemoData() {
    resetDemo();
    toast.success("Demo data reset");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Business and restaurant configuration.
        </p>
      </div>

      {isDemoMode() && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You’re in <strong>demo mode</strong>, changes are saved to this
          browser only and reset when you sign up for real. Use the button below
          to restore the sample menu and sales.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Restaurant details</CardTitle>
            <CardDescription>
              Appears on receipts and reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="r-name">Restaurant name</Label>
                  <Input
                    id="r-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-addr">Address</Label>
                  <Input
                    id="r-addr"
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    placeholder="e.g. Waigani Drive, Port Moresby"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="r-tax">GST / tax rate (%)</Label>
                  <Input
                    id="r-tax"
                    type="number"
                    step="0.1"
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Many PNG restaurants are not GST-registered, leave at 0 if
                    that applies to you.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-currency">Currency</Label>
                  <Input id="r-currency" value={currency} disabled />
                </div>
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Your current plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Business</span>
              <span className="font-medium">{businessName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="capitalize font-medium">{plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Billing</span>
              <span className="font-medium">K79/month (Starter)</span>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Billing and plan upgrades arrive in a later release.
            </p>
          </CardContent>
        </Card>
      </div>

      {isDemoMode() && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Reset demo data</CardTitle>
            <CardDescription>
              Clear everything and restore the original sample menu and sales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm("Reset all demo data to the defaults?")) {
                  void resetDemoData();
                }
              }}
            >
              Reset demo data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}