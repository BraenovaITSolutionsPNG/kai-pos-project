"use client";

import * as Lucide from "lucide-react";
import { SVGProps } from "react";

export function Icon({
  name,
  ...props
}: { name: string } & SVGProps<SVGSVGElement>) {
  const Icon = (Lucide as Record<string, React.ComponentType<Record<string, unknown>>>)[name];
  if (!Icon) return null;
  return <Icon {...props} />;
}
