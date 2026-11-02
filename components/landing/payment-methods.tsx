import { createClient } from "@/lib/supabase/server";
import { CreditCard } from "lucide-react";

interface PaymentMethod {
  name: string;
  logo_url: string | null;
}

const DEFAULT_METHODS: PaymentMethod[] = [
  { name: "BSP", logo_url: null },
  { name: "Kina Bank", logo_url: null },
  { name: "ANZ", logo_url: null },
  { name: "Westpac", logo_url: null },
  { name: "EFTPOS", logo_url: null },
  { name: "Cash", logo_url: null },
];

export async function PaymentMethods() {
  let methods = DEFAULT_METHODS;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_content")
      .select("value")
      .eq("key", "payment_methods")
      .single();
    if (data?.value && Array.isArray(data.value)) {
      methods = data.value as PaymentMethod[];
    }
  } catch {
    // Use defaults
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Accepts all major PNG payment methods
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {methods.map((m) => (
            <span
              key={m.name}
              className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm"
            >
              {m.logo_url ? (
                <img src={m.logo_url} alt={m.name} className="h-6 object-contain" />
              ) : (
                <CreditCard className="size-4 text-muted-foreground" />
              )}
              {m.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

