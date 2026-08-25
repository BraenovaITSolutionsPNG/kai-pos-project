"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signup, type AuthState } from "@/lib/auth-actions";
import { PLAN_PRICES, type PlanName } from "@/lib/plans";

export function SignupForm({
  plan,
}: {
  plan?: "starter" | "business" | "professional";
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup,
    undefined
  );
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");

  const price = (p: PlanName) =>
    cycle === "annual"
      ? PLAN_PRICES[p].annual
      : PLAN_PRICES[p].monthly;

  return (
    <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <UtensilsCrossed className="size-6" />
        </div>
        <h1 className="font-heading text-xl font-semibold">Start your business</h1>
        <p className="text-sm text-muted-foreground">
          Your business and a starter menu are set up automatically.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="plan">Select your plan</Label>
          <Select name="plan" defaultValue={plan} required>
            <SelectTrigger id="plan" className="w-full">
              <SelectValue placeholder="Choose a plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">
                Starter (K{price("starter")}/{cycle === "annual" ? "year" : "month"})
              </SelectItem>
              <SelectItem value="business">
                Business (K{price("business")}/{cycle === "annual" ? "year" : "month"})
              </SelectItem>
              <SelectItem value="professional">
                Professional (K{price("professional")}/{cycle === "annual" ? "year" : "month"})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Billing cycle</Label>
          <input type="hidden" name="cycle" value={cycle} />
          <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
            {(["monthly", "annual"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  cycle === c
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                {c === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
          {cycle === "annual" && (
            <p className="text-xs text-muted-foreground">
              Annual plans include 2 months free. Billed once a year.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name">Your full name</Label>
          <Input
            id="full_name"
            name="full_name"
            placeholder="e.g. Joel Namuri"
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_name">Business name (optional)</Label>
          <Input
            id="business_name"
            name="business_name"
            placeholder="e.g. Koki Seafood House"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@restaurant.pg"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
        </div>

        {state?.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state?.message && !state.error && (
          <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            {state.message}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Creating your cafe…" : "Create cafe"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Sign in
        </Link>
      </p>

      <p className="mt-3 border-t pt-4 text-center text-sm">
        <Link href="/" className="font-medium text-foreground hover:underline">
          Back to home page
        </Link>
      </p>
    </div>
  );
}