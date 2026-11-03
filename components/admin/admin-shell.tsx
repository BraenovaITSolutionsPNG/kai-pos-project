"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  PenLine,
  ShieldCheck,
  Users,
  UtensilsCrossed,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth-actions";
import { useFormStatus } from "react-dom";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  { title: "Businesses", href: "/admin/businesses", icon: Building2 },
  { title: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Messages", href: "/admin/messages", icon: Mail },
  { title: "Content", href: "/admin/content", icon: PenLine },
  { title: "Payment Methods", href: "/admin/payment-methods", icon: CreditCard },
];

function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      form="logout-form"
      type="submit"
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">{pending ? "Signing out…" : "Sign out"}</span>
    </Button>
  );
}

function LogoutForm() {
  return (
    <form id="logout-form" action={logout} className="inline">
      <LogoutButton />
    </form>
  );
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={item.title}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            <Icon className="size-4.5 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  userName,
  userEmail,
  children,
}: {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-muted/30">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="font-heading text-sm font-semibold">KAI Platform Admin</p>
              <p className="text-[11px] text-muted-foreground">
                {userName} · {userEmail}
              </p>
            </div>
          )}
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className="border-t p-3 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
            {!collapsed && <span>Collapse</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            <UtensilsCrossed className="size-4" />
            {!collapsed && <span>POS app</span>}
          </Button>
          <LogoutForm />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center gap-2 border-b px-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="font-heading text-sm font-semibold">KAI Platform Admin</p>
              <p className="text-[11px] text-muted-foreground">
                {userName} · {userEmail}
              </p>
            </div>
          </div>
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          <div className="border-t p-3 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              nativeButton={false}
              render={<Link href="/dashboard" />}
            >
              <UtensilsCrossed className="size-4" />
              <span>POS app</span>
            </Button>
            <LogoutForm />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b bg-card/80 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
            <span className="sr-only">Open menu</span>
          </Button>
          <span className="font-heading text-sm font-semibold">KAI Platform Admin</span>
        </header>
        <main className="grow p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
