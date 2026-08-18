"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PenLine,
  ShieldCheck,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth-actions";

const navItems = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  { title: "Businesses", href: "/admin/businesses", icon: Building2 },
  { title: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Content", href: "/admin/content", icon: PenLine },
];

export function AdminShell({
  userName,
  userEmail,
  children,
}: {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="font-heading text-sm font-semibold">KAI Platform Admin</p>
            <p className="text-[11px] text-muted-foreground">
              {userName} · {userEmail}
            </p>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{item.title}</span>
                </Link>
              );
            })}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            <UtensilsCrossed className="size-4" />
            <span className="hidden sm:inline">POS app</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await logout();
            }}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">{busy ? "Signing out…" : "Sign out"}</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl grow p-4 sm:p-6">{children}</main>
      <footer className="border-t bg-card">
        <p className="mx-auto w-full max-w-6xl px-4 py-3 text-xs text-muted-foreground">
          KAI POS — platform administration
        </p>
      </footer>
    </div>
  );
}