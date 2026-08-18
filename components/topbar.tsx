"use client";

import { useState } from "react";
import { Building2, FlaskConical, LogOut, ChevronDown, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isDemoMode } from "@/lib/supabase/env";
import { logout } from "@/lib/auth-actions";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function Topbar({
  restaurantName,
  userName,
  userRole,
  userEmail,
  onMenuClick,
}: {
  restaurantName: string;
  userName: string;
  userRole: string;
  userEmail: string;
  onMenuClick: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 px-4 backdrop-blur sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="size-5" />
        <span className="sr-only">Open menu</span>
      </Button>

      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{restaurantName}</span>
        {isDemoMode() && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            <FlaskConical className="size-3" />
            Demo
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2.5">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {initials(userName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:block">{userName}</span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium text-foreground">{userName}</p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {userRole}
                </p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await logout();
              }}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}