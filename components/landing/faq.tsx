"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is KAI POS only for restaurants and cafes?",
    a: "No! KAI POS works for any business - cafes, restaurants, takeaways, retail shops, bars, and more. If you sell products and need to track sales, inventory, and staff, KAI POS is for you.",
  },
  {
    q: "How much does it cost?",
    a: "Plans start at K500/month for Starter, K1,500/month for Business, and K2,500/month for Professional. Annual plans include 2 months free. All prices are in PNG Kina.",
  },
  {
    q: "Do I need internet to use it?",
    a: "KAI POS works offline-friendly. Sales are recorded locally and sync when internet is available. You need internet for initial setup and syncing.",
  },
  {
    q: "Can I use it on my phone or tablet?",
    a: "Yes! KAI POS works on any device - tablets, phones, or PCs. It installs as a Progressive Web App (PWA) for a native app-like experience.",
  },
  {
    q: "How do I set up my menu?",
    a: "After signing up, you can add products and categories manually, or start from a ready-made starter menu. You can also import from a spreadsheet.",
  },
  {
    q: "What payment methods are supported?",
    a: "Cash, EFTPOS, BSP, Kina Bank, ANZ, Westpac, and more. All major PNG payment methods are supported.",
  },
  {
    q: "Can I manage multiple locations?",
    a: "Yes! The Professional plan includes multi-branch management with an owner dashboard to view all locations.",
  },
  {
    q: "Is there a free trial?",
    a: "Contact us to arrange a demo. Setup and training are available from K300.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight">
          Frequently asked questions
        </h2>
        <p className="mt-3 text-muted-foreground">
          Everything you need to know about KAI POS
        </p>
      </div>
      <div className="mt-10 space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="rounded-xl border bg-card shadow-sm">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <span className="text-sm font-medium">{faq.q}</span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  openIndex === i && "rotate-180"
                )}
              />
            </button>
            {openIndex === i && (
              <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

