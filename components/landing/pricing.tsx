"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    monthly: "K500",
    annual: "K5000",
    period: "/month",
    description: "Everything you need to start taking orders.",
    features: [
      "POS & receipt printing",
      "Products & categories",
      "Orders history",
      "Daily sales dashboard",
      "Up to 2 staff accounts",
    ],
    highlight: false,
  },
  {
    name: "Business",
    monthly: "K1,500",
    annual: "K15,000",
    period: "/month",
    description: "The complete operating system for a busy restaurant & cafe.",
    features: [
      "Everything in Starter",
      "Tables & floor plan",
      "Kitchen display system",
      "Inventory & recipes with auto stock deduction",
      "Reports, payment split & expense tracking",
      "Up to 5 staff accounts",
    ],
    highlight: true,
  },
  {
    name: "Professional",
    monthly: "K2,500",
    annual: "K25,000",
    period: "/month",
    description: "For growing teams that need more.",
    features: [
      "Everything in Business",
      "Unlimited staff accounts",
      "Priority support",
      "Dedicated onboarding & training",
    ],
    highlight: false,
  },
];

export default function Pricing({
  heading = "Simple plans, honest Kina pricing",
  subtext = "Pick a plan and grow. Setup & training available from K300.",
  note = "Annual plans include 2 months free. Billed once a year.",
  footer = "All plans include product setup support and PNG payment methods.",
}: {
  heading?: string;
  subtext?: string;
  note?: string;
  footer?: string;
}) {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight">
          {heading}
        </h2>
        <p className="mt-3 text-muted-foreground">
          {subtext}
        </p>
        <div className="mt-6 inline-flex items-center gap-1 rounded-full border bg-muted p-1">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              !annual ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              annual ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            Annual
          </button>
        </div>
        {annual && (
          <p className="mt-2 text-xs text-muted-foreground">
            {note}
          </p>
        )}
      </div>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={cn(
              "relative flex flex-col rounded-xl border bg-card p-6",
              p.highlight && "border-primary shadow-lg"
            )}
          >
            {p.highlight && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most popular
              </Badge>
            )}
            <h3 className="font-heading font-semibold">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            <p className="mt-4">
              <span className="font-heading text-4xl font-semibold">
                {annual ? p.annual : p.monthly}
              </span>
              <span className="text-sm text-muted-foreground">
                {annual ? "/year" : p.period}
              </span>
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <LayoutDashboard className="mt-0.5 size-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={`/signup?plan=${encodeURIComponent(p.name)}`}
              className={cn(
                buttonVariants({
                  variant: p.highlight ? "default" : "outline",
                }),
                "mt-6 w-full"
              )}
            >
              Start your business
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {footer}
      </p>
    </section>
  );
}