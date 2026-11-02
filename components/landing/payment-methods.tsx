import { CreditCard } from "lucide-react";

const methods = ["BSP", "Kina Bank", "ANZ", "Westpac", "EFTPOS", "Cash"];

export function PaymentMethods() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Accepts all major PNG payment methods
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {methods.map((m) => (
            <span
              key={m}
              className="rounded-lg border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

