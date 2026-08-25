import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ChefHat,
  ClipboardList,
  CreditCard,
  MonitorSmartphone,
  ShieldCheck,
  ShoppingCart,
  Table,
  Tags,
  Users,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Pricing from "@/components/landing/pricing";
import { CountUp } from "@/components/landing/count-up";
import { FoodAnimation } from "@/components/landing/food-animation";
import { getSiteContent, getMySubscription } from "@/lib/queries";
import { resolveSiteContent, renderAccent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Restaurant & Cafe POS for Papua New Guinea",
  description:
    "KAI POS is the all-in-one restaurant & cafe operating system for PNG with POS, tables, kitchen display, inventory, staff and reports, built around the Kina.",
};

export const dynamic = "force-dynamic";

const features = [
  {
    icon: ShoppingCart,
    title: "Fast POS",
    text: "Touch-friendly sales screen with category tabs and one-tap checkout. Cash, EFTPOS, BSP, Kina Bank, ANZ, Westpac and more.",
  },
  {
    icon: ClipboardList,
    title: "Orders",
    text: "Every sale recorded with itemised lines, payments and printable PGK receipts, so no more paper and calculators.",
  },
  {
    icon: Table,
    title: "Tables & floor plan",
    text: "A colour-coded floor plan that shows which tables are free, occupied or reserved at a glance.",
  },
  {
    icon: ChefHat,
    title: "Kitchen display",
    text: "Orders flow to the kitchen as tickets that move New → Preparing → Ready, so nothing gets forgotten.",
  },
  {
    icon: Boxes,
    title: "Inventory & recipes",
    text: "Track ingredient stock, set recipes and get low-stock alerts. Sales deduct stock automatically.",
  },
  {
    icon: BarChart3,
    title: "Reports",
    text: "Daily sales, top products, payment split and expenses, so you know what your cafe makes each day.",
  },
  {
    icon: Users,
    title: "Staff & roles",
    text: "Owner, manager, cashier, kitchen and waiter accounts with role-based access to your system.",
  },
  {
    icon: Tags,
    title: "Menu management",
    text: "Products and categories in Kina pricing, with images and visibility toggles for the POS screen.",
  },
];

const steps = [
  {
    step: "1",
    title: "Create your cafe",
    text: "Sign up and your business, restaurant or cafe, and owner account are set up automatically.",
  },
  {
    step: "2",
    title: "Add your menu",
    text: "Type in your products and prices in Kina, or start from a ready-made starter menu.",
  },
  {
    step: "3",
    title: "Start selling",
    text: "Ring up sales on any tablet, phone or PC, installed as an app that works offline-friendly.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_platform_admin")
      .eq("id", user.id)
      .maybeSingle();
    // Platform admins run the site, not a restaurant.
    if (profile?.is_platform_admin) redirect("/admin");
    // Owners with an active plan go straight into the app; owners whose
    // payment is pending are taken to billing.
    const sub = await getMySubscription();
    if (!sub || sub.status === "active") redirect("/dashboard");
    redirect("/subscription");
  }

  const content = resolveSiteContent(await getSiteContent());

  return (
    <div className="min-h-svh bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur animate-slide-down">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform duration-300 hover:rotate-12 hover:scale-110">
              <UtensilsCrossed className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="font-heading text-sm font-semibold">KAI POS</p>
              <p className="text-[11px] text-muted-foreground">by BraeNova IT Solutions</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Get started
              <ArrowRight />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-300/60 via-orange-300/50 to-rose-300/50">
        {/* Hero banner with platform features */}
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="relative lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
            {/* Left: Copy */}
            <div className="relative z-10">
              <Badge
                variant="outline"
                className="mb-4 animate-fade-up gap-1.5"
              >
                <MonitorSmartphone className="size-3.5" />
                {content.hero.badge}
              </Badge>
              <h1 className="animate-fade-up font-heading text-4xl font-semibold leading-tight tracking-tight [animation-delay:100ms] sm:text-5xl lg:text-6xl">
                {renderAccent(content.hero.title)}
              </h1>
              <p className="mt-6 max-w-xl animate-fade-up text-lg text-muted-foreground [animation-delay:200ms] lg:text-xl">
                {content.hero.subtitle}
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3 [animation-delay:300ms] animate-fade-up">
                <Link
                  href="/signup"
                  className={cn(
                    "group",
                    buttonVariants({ size: "lg" })
                  )}
                >
                  {content.hero.cta}
                  <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link
                  href="#features"
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
                >
                  {content.hero.cta2}
                </Link>
              </div>
              <p className="mt-6 animate-fade-up text-sm text-muted-foreground [animation-delay:400ms]">
                Your menu is set up for you
              </p>

              {/* Feature highlights */}
              <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 [animation-delay:500ms] animate-fade-up">
                {[
                  { icon: ShoppingCart, label: "Fast POS", desc: "Touch-friendly sales" },
                  { icon: ChefHat, label: "Kitchen Display", desc: "Orders flow to kitchen" },
                  { icon: Table, label: "Tables & Floor Plan", desc: "Visual floor plan" },
                  { icon: BarChart3, label: "Reports & Insights", desc: "Real-time analytics" },
                ].map((f, i) => (
                  <div
                    key={f.label}
                    className="flex items-start gap-3 rounded-xl bg-white/80 backdrop-blur-sm p-4 border border-amber-100 shadow-sm hover:shadow-md transition-shadow"
                    style={{ animationDelay: `${500 + i * 80}ms` }}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <f.icon className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{f.label}</p>
                      <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Platform showcase */}
            <div className="relative mt-12 lg:mt-0 [animation-delay:300ms] animate-fade-up">
              <div className="relative">
                {/* Main platform mockup */}
                <div className="relative rounded-2xl border border-amber-200 bg-white shadow-2xl overflow-hidden">
                  {/* Top bar */}
                  <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <UtensilsCrossed className="size-4" />
                    </div>
                    <div className="text-sm font-medium text-gray-900">KAI POS Dashboard</div>
                    <div className="ml-auto flex items-center gap-2">
                      <Badge className="gap-1.5 bg-green-100 text-green-700 border-green-200">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                        </span>
                        Live
                      </Badge>
                    </div>
                  </div>

                  {/* Dashboard content */}
                  <div className="p-6 space-y-6">
                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Today's Sales", value: "K1,240", icon: ShoppingCart, color: "emerald" },
                        { label: "Orders", value: "48", icon: ClipboardList, color: "blue" },
                        { label: "Avg Order", value: "K25.83", icon: BarChart3, color: "amber" },
                      ].map((m, i) => (
                        <div
                          key={m.label}
                          className="rounded-xl bg-gray-50 p-4 border border-gray-100"
                          style={{ animationDelay: `${400 + i * 100}ms` }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{m.label}</p>
                            <div className={`flex size-8 items-center justify-center rounded-lg bg-${m.color}-100 text-${m.color}-600`}>
                              <m.icon className="size-4" />
                            </div>
                          </div>
                          <CountUp
                            to={Number(m.value.replace("K", "").replace(",", ""))}
                            decimals={m.value.includes(".") ? 2 : 0}
                            prefix={m.value.startsWith("K") ? "K" : ""}
                            duration={1400 + i * 200}
                            className="font-heading text-2xl font-bold text-gray-900"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Recent orders */}
                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">Recent Orders</h4>
                        <span className="text-sm text-muted-foreground">Live updates</span>
                      </div>
                      <div className="space-y-2 rounded-lg border border-gray-100 overflow-hidden">
                        {[
                          { name: "Chicken Fried Rice", qty: "2×", price: "K50.00", status: "Ready", statusColor: "emerald" },
                          { name: "Fish & Chips", qty: "1×", price: "K32.00", status: "Preparing", statusColor: "amber" },
                          { name: "Mango Juice", qty: "3×", price: "K24.00", status: "New", statusColor: "blue" },
                        ].map((o, i) => (
                          <div
                            key={o.name}
                            className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                            style={{ animationDelay: `${700 + i * 100}ms` }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                <UtensilsCrossed className="size-4" />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-gray-900">{o.name}</p>
                                <p className="text-[11px] text-muted-foreground">{o.qty} · {o.price}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={`border-${o.statusColor}-200 text-${o.statusColor}-700 bg-${o.statusColor}-50`}>
                                {o.status}
                              </Badge>
                              <span className="font-semibold text-amber-700">{o.price}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating feature cards */}
                <div className="absolute -top-4 -right-4 hidden lg:block">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-lg border border-amber-100 shadow-amber-100/50 animate-float">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                        <Wifi className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">Orders synced</p>
                        <p className="text-[11px] text-muted-foreground">Real-time across devices</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-lg border border-amber-100 shadow-amber-100/50 animate-float" style={{ animationDelay: "500ms" }}>
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">Staff roles locked</p>
                        <p className="text-[11px] text-muted-foreground">Secure access control</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom floating cards */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4 lg:hidden">
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg border border-amber-100">
                    <Wifi className="size-4 text-green-500" />
                    <span className="text-sm font-medium">Orders synced</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gradient orbs for depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/4 size-72 animate-orb-a rounded-full bg-amber-400/50 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-40 size-80 animate-orb-b rounded-full bg-orange-400/45 blur-3xl"
        />
      </section>

      {/* Stats strip */}
      <section className="border-y bg-gradient-to-br from-amber-50/50 via-orange-50/40 to-rose-50/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {[
            { value: "8+", label: "Payment methods supported" },
            { value: "10+", label: "Modules included" },
            { value: "PGK", label: "Priced in Papua New Guinea Kina" },
            { value: "1", label: "Setup, your cafe ready today" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-heading text-2xl font-semibold text-primary">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-amber-50/40 via-orange-50/30 to-rose-50/40 rounded-3xl blur-2xl" />
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            {content.features.heading}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {content.features.subtext}
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-heading font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative border-y bg-gradient-to-br from-amber-50/50 via-orange-50/40 to-rose-50/50">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-amber-50/40 via-transparent to-rose-50/40" />
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              {content.how.heading}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {content.how.subtext}
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.step} className="rounded-xl border bg-card p-6">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary font-heading font-semibold text-primary-foreground">
                  {s.step}
                </div>
                <h3 className="mt-4 font-heading font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Get started
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-amber-50/40 via-orange-50/30 to-rose-50/40 rounded-3xl blur-2xl" />
        <Pricing
          heading={content.pricing.heading}
          subtext={content.pricing.subtext}
          note={content.pricing.note}
          footer={content.pricing.footer}
        />
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            {content.cta.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {content.cta.subtext}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Get started
              <ArrowRight />
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-amber-100/30 via-transparent to-rose-100/30" />
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UtensilsCrossed className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="font-heading text-sm font-semibold">KAI POS</p>
              <p className="text-[11px] text-muted-foreground">
                Restaurant & Cafe platform · Papua New Guinea
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CreditCard className="size-4" />
              Billed in PGK
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4" />
              Your data, yours
            </span>
            <span>© {new Date().getFullYear()} BraeNova IT Solutions</span>
          </div>
        </div>
      </footer>
    </div>
  );
}