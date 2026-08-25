import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/images/logo.svg"
      alt="KAI POS"
      className={cn("object-contain", className)}
    />
  );
}
