"use client";

import { useActionState } from "react";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type AuthState } from "@/lib/auth-actions";

export function LoginForm({ message }: { message?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    login,
    { message }
  );

  return (
    <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <UtensilsCrossed className="size-6" />
        </div>
        <h1 className="font-heading text-xl font-semibold">Sign in to KAI POS</h1>
        <p className="text-sm text-muted-foreground">
          Restaurant & Cafe operating system for Papua New Guinea
        </p>
      </div>

      <form action={action} className="space-y-4">
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
            placeholder="••••••••"
            autoComplete="current-password"
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
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to KAI POS?{" "}
        <Link href="/signup" className="font-medium text-foreground underline">
          Subscribe now
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