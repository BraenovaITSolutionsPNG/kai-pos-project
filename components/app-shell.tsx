"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mainNav, laterNav } from "@/components/nav-items";
import { canAccess, type StaffRole } from "@/lib/permissions";
import type { PlanName } from "@/lib/plans";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Topbar } from "@/components/topbar";

function SidebarNav({
  collapsed,
  role,
  plan,
  isPlatformAdmin,
  onNavigate,
}: {
  collapsed: boolean;
  role: StaffRole;
  plan?: PlanName;
  isPlatformAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = [...mainNav, ...laterNav].filter((i) =>
    canAccess(role, i.href, plan)
  );

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {collapsed ? null : (
        <p className="px-2 pb-2 text-xs font-medium uppercase text-muted-foreground/70">
          Menu
        </p>
      )}
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        if (item.disabled) {
          return (
            <div
              key={item.title}
              title={item.title}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground/50",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="size-4.5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
              {!collapsed && (
                <span className="ml-auto rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                  soon
                </span>
              )}
            </div>
          );
        }
        return (
          <Link
            key={item.title}
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

      {isPlatformAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          title="Platform Admin"
          className={cn(
            "mt-1 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-2 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10",
            collapsed && "justify-center px-0"
          )}
        >
          <ShieldCheck className="size-4.5 shrink-0" />
          {!collapsed && <span>Platform Admin</span>}
        </Link>
      )}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-14 items-center gap-2 border-b px-4">
      <BrandLogo className="size-8 shrink-0 rounded-lg bg-white p-1 shadow-sm" />
      {!collapsed && (
        <div className="leading-tight">
          <p className="font-heading text-sm font-semibold">KAI POS</p>
          <p className="text-[11px] text-muted-foreground">
            Restaurant & Cafe platform
          </p>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  restaurantName,
  userName,
  userRole,
  userEmail,
  plan,
  isPlatformAdmin = false,
  children,
}: {
  restaurantName: string;
  userName: string;
  userRole: string;
  userEmail: string;
  plan?: PlanName;
  isPlatformAdmin?: boolean;
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
        <Brand collapsed={collapsed} />
        <SidebarNav
          collapsed={collapsed}
          role={userRole as StaffRole}
          plan={plan}
          isPlatformAdmin={isPlatformAdmin}
        />
        <div className="border-t p-3">
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
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          }
        />
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand collapsed={false} />
          <SidebarNav
            collapsed={false}
            role={userRole as StaffRole}
            plan={plan}
            isPlatformAdmin={isPlatformAdmin}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          restaurantName={restaurantName}
          userName={userName}
          userRole={userRole}
          userEmail={userEmail}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="grow p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
