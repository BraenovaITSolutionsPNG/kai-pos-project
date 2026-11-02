"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
        <span className="sr-only">Toggle menu</span>
      </Button>
      {open && (
        <div className="absolute left-0 right-0 top-16 z-40 border-b bg-background/95 backdrop-blur p-4 shadow-lg">
          <nav className="flex flex-col gap-3 text-sm font-medium text-muted-foreground">
            <a href="#features" onClick={() => setOpen(false)} className="transition-colors hover:text-foreground py-2">
              Features
            </a>
            <a href="#how" onClick={() => setOpen(false)} className="transition-colors hover:text-foreground py-2">
              How it works
            </a>
            <a href="#pricing" onClick={() => setOpen(false)} className="transition-colors hover:text-foreground py-2">
              Pricing
            </a>
            <Link href="/contact" onClick={() => setOpen(false)} className="transition-colors hover:text-foreground py-2">
              Contact
            </Link>
            <div className="flex gap-2 pt-2 border-t">
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex-1")}>
                Sign in
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "flex-1")}>
                Get started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}

