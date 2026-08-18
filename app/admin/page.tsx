import type { Metadata } from "next";
import {
  Building2,
  MapPin,
  ShoppingBag,
  Users,
  Wallet,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
import { formatKina } from "@/lib/format";
import { getAdminOverview } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Platform overview",
};

export default async function AdminOverviewPage() {
  const stats = await getAdminOverview();

  const cards = [
    {
      label: "Businesses",
      value: String(stats.businesses),
      sub: `${stats.active_businesses} active · ${stats.businesses - stats.active_businesses} suspended`,
      icon: Building2,
    },
    {
      label: "Restaurants",
      value: String(stats.restaurants),
      sub: "Across all businesses",
      icon: MapPin,
    },
    {
      label: "Users",
      value: String(stats.users),
      sub: `${stats.platform_admins} platform admin(s)`,
      icon: Users,
    },
    {
      label: "Active staff",
      value: String(stats.staff),
      sub: "Working today",
      icon: UtensilsCrossed,
    },
    {
      label: "Orders placed",
      value: String(stats.orders),
      sub: "All time",
      icon: ShoppingBag,
    },
    {
      label: "Total revenue",
      value: formatKina(stats.revenue),
      sub: "Excluding cancelled orders",
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Platform overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything running on KAI POS, at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4" />
                {c.label}
              </div>
              <p className="mt-2 font-heading text-2xl font-semibold tracking-tight">
                {c.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <ShieldCheck className="size-4 text-primary" />
        You have platform-wide access. Use the nav above to manage businesses
        and users.
      </div>
    </div>
  );
}