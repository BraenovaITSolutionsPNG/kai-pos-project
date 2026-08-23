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
import { getSiteContent, getMySubscription } from "@/lib/queries";
import { resolveSiteContent, renderAccent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Restaurant POS for Papua New Guinea",
  description:
    "KAI POS is the all-in-one restaurant operating system for PNG with POS, tables, kitchen display, inventory, staff and reports, built around the Kina.",
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
    text: "Owner, manager, cashier and kitchen accounts with role-based access to your system.",
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
    text: "Sign up and your business, restaurant and owner account are set up automatically.",
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
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"
        />
        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:pt-24">
          <div>
            <Badge variant="outline" className="mb-4 gap-1.5">
              <MonitorSmartphone className="size-3.5" />
              {content.hero.badge}
            </Badge>
            <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {renderAccent(content.hero.title)}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">
              {content.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                {content.hero.cta}
                <ArrowRight />
              </Link>
              <Link
                href="#features"
                className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
              >
                {content.hero.cta2}
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Your menu is set up for you
            </p>
          </div>

          {/* App mockup */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="rounded-2xl border bg-card p-4 shadow-2xl">
              <div className="mb-4 flex items-center gap-2 border-b pb-3">
                <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <UtensilsCrossed className="size-4" />
                </div>
                <div className="text-sm font-medium">KAI POS Today</div>
                <Badge className="ml-auto">Live</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Sales", value: "K1,240" },
                  { label: "Orders", value: "48" },
                  { label: "Avg", value: "K25.83" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    <p className="font-heading text-sm font-semibold">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { name: "Chicken Fried Rice", qty: "2×", price: "K50.00" },
                  { name: "Fish & Chips", qty: "1×", price: "K32.00" },
                  { name: "Mango Juice", qty: "3×", price: "K24.00" },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{item.qty}</span> {item.name}
                    </span>
                    <span className="text-muted-foreground">{item.price}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-primary p-3 text-center text-sm font-semibold text-primary-foreground">
                Total K106.00 · EFTPOS
              </div>
            </div>
            <div className="absolute -bottom-5 -left-6 hidden rounded-xl border bg-card px-4 py-3 shadow-lg sm:block">
              <div className="flex items-center gap-2 text-sm">
                <Wifi className="size-4 text-green-500" />
                <span>Orders synced</span>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 hidden rounded-xl border bg-card px-4 py-3 shadow-lg sm:block">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-primary" />
                <span>Staff roles locked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y bg-muted/40">
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
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
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
      <section id="how" className="border-y bg-muted/40">
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
      <Pricing
        heading={content.pricing.heading}
        subtext={content.pricing.subtext}
        note={content.pricing.note}
        footer={content.pricing.footer}
      />

      {/* CTA */}
      <section className="border-t bg-muted/40">
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
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UtensilsCrossed className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="font-heading text-sm font-semibold">KAI POS</p>
              <p className="text-[11px] text-muted-foreground">
                Restaurant platform · Papua New Guinea
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