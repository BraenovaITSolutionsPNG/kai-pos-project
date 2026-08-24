import type { ReactNode } from "react";
import type { SiteContentRow } from "@/lib/queries";

export interface SiteContent {
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    cta: string;
    cta2: string;
  };
  features: { heading: string; subtext: string };
  how: { heading: string; subtext: string };
  pricing: { heading: string; subtext: string; note: string; footer: string };
  cta: { heading: string; subtext: string };
  bank_details: {
    bank_name: string;
    account_name: string;
    account_number: string;
    branch: string;
    swift: string;
  };
}

export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    badge: "Built for Papua New Guinea",
    title: "Run your restaurant & cafe the {accent}smart way{/accent}, in Kina.",
    subtitle:
      "KAI POS is an all-in-one point of sale, kitchen, inventory and reporting platform made for PNG restaurants & cafes. Say goodbye to paper receipts and the calculator.",
    cta: "Get started",
    cta2: "See what's inside",
  },
  features: {
    heading: "Everything your restaurant & cafe needs",
    subtext:
      "From the cashier to the kitchen to the owner's office, one platform, one source of truth.",
  },
  how: {
    heading: "Selling in three simple steps",
    subtext: "Get from signup to ringing up your first order in minutes.",
  },
  pricing: {
    heading: "Simple plans, honest Kina pricing",
    subtext: "Pick a plan and grow. Setup & training available from K300.",
    note: "Annual plans include 2 months free. Billed once a year.",
    footer:
      "All plans include product setup support and PNG payment methods.",
  },
  cta: {
    heading: "Ready to run your restaurant & cafe the smart way?",
    subtext:
      "Create your cafe, add your menu and start taking orders, in Kina, on any tablet or phone.",
  },
  bank_details: {
    bank_name: "BSP (Bank South Pacific)",
    account_name: "KAI POS Pty Ltd",
    account_number: "1000 123 456",
    branch: "Waigani, Port Moresby",
    swift: "BOSPPGPM",
  },
};

function pick<T extends Record<string, unknown>>(
  value: unknown,
  defaults: T
): T {
  if (!value || typeof value !== "object") return defaults;
  const obj = value as Record<string, unknown>;
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const v = obj[key as string];
    if (typeof v === "string" && v.trim() !== "") {
      (out as Record<string, unknown>)[key as string] = v;
    }
  }
  return out;
}

export function resolveSiteContent(rows: SiteContentRow[]): SiteContent {
  const map = new Map(rows.map((r) => [r.id, r.value]));
  return {
    hero: pick(map.get("hero"), DEFAULT_CONTENT.hero),
    features: pick(map.get("features"), DEFAULT_CONTENT.features),
    how: pick(map.get("how"), DEFAULT_CONTENT.how),
    pricing: pick(map.get("pricing"), DEFAULT_CONTENT.pricing),
    cta: pick(map.get("cta"), DEFAULT_CONTENT.cta),
    bank_details: pick(map.get("bank_details"), DEFAULT_CONTENT.bank_details),
  };
}

// Renders "{accent}...{/accent}" markers as a primary-colored span.
export function renderAccent(text: string): ReactNode {
  const parts = text.split(/\{accent\}|\{\/accent\}/g);
  if (parts.length < 3) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="text-primary">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}