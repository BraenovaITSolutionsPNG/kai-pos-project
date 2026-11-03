import { Icon } from "@/components/ui/icon";

const badges = [
  { icon: "Globe", label: "PNG-built", desc: "Made for Papua New Guinea businesses" },
  { icon: "Coins", label: "Kina pricing", desc: "All prices in PGK, no USD conversions" },
  { icon: "Headphones", label: "Local support", desc: "PNG-based support team" },
  { icon: "Wifi", label: "Offline-friendly", desc: "Works with spotty internet" },
  { icon: "Smartphone", label: "Any device", desc: "Tablet, phone or PC" },
  { icon: "ShieldCheck", label: "Your data", desc: "You own your business data" },
];

export function TrustBadges() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {badges.map((b) => (
            <div key={b.label} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name={b.icon} className="size-5" />
              </div>
              <p className="text-sm font-semibold">{b.label}</p>
              <p className="text-xs text-muted-foreground">{b.desc}</p>
            </div>
          ))}
      </div>
    </section>
  );
}

