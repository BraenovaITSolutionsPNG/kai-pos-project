"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SECTIONS: {
  id: string;
  title: string;
  description?: string;
  fields: { key: string; label: string; textarea?: boolean }[];
}[] = [
  {
    id: "hero",
    title: "Hero",
    fields: [
      { key: "badge", label: "Badge text" },
      { key: "title", label: "Title (use {accent} around highlighted words)" },
      { key: "subtitle", label: "Subtitle", textarea: true },
      { key: "cta", label: "Primary button text" },
      { key: "cta2", label: "Secondary button text" },
    ],
  },
  {
    id: "features",
    title: "Features section",
    fields: [
      { key: "heading", label: "Heading" },
      { key: "subtext", label: "Subtext", textarea: true },
    ],
  },
  {
    id: "how",
    title: "How it works",
    fields: [
      { key: "heading", label: "Heading" },
      { key: "subtext", label: "Subtext", textarea: true },
    ],
  },
  {
    id: "pricing",
    title: "Pricing section",
    fields: [
      { key: "heading", label: "Heading" },
      { key: "subtext", label: "Subtext" },
      { key: "note", label: "Annual note" },
      { key: "footer", label: "Footer note" },
    ],
  },
  {
    id: "cta",
    title: "Final call to action",
    fields: [
      { key: "heading", label: "Heading" },
      { key: "subtext", label: "Subtext", textarea: true },
    ],
  },
  {
    id: "bank_details",
    title: "Company bank details",
    description:
      "Shown to business owners on the subscription payment page so they know where to transfer.",
    fields: [
      { key: "bank_name", label: "Bank name" },
      { key: "account_name", label: "Account name" },
      { key: "account_number", label: "Account number" },
      { key: "branch", label: "Branch / city" },
      { key: "swift", label: "SWIFT / BPNG code" },
    ],
  },
];

export function ContentClient({
  initial,
}: {
  initial: Record<string, Record<string, unknown>>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);

  function set(id: string, key: string, value: string) {
    setValues((v) => ({
      ...v,
      [id]: { ...(v[id] ?? {}), [key]: value },
    }));
  }

  async function save() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_site_content", {
      items: SECTIONS.map((s) => ({
        id: s.id,
        value: values[s.id] ?? {},
      })),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Landing page content saved");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Landing page content
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit what visitors see on the public home page. Changes go live
            immediately.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.id} className="rounded-xl border bg-card">
          <p className="border-b px-4 py-3 font-heading text-sm font-semibold">
            {section.title}
          </p>
          {section.description && (
            <p className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              {section.description}
            </p>
          )}
          <div className="space-y-4 p-4">
            {section.fields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>{f.label}</Label>
                {f.textarea ? (
                  <textarea
                    value={String(values[section.id]?.[f.key] ?? "")}
                    onChange={(e) => set(section.id, f.key, e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                ) : (
                  <Input
                    value={String(values[section.id]?.[f.key] ?? "")}
                    onChange={(e) => set(section.id, f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}