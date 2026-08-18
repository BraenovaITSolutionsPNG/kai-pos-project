import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create cafe",
};

export const dynamic = "force-dynamic";

const VALID_PLANS = ["starter", "business", "professional"] as const;
type Plan = (typeof VALID_PLANS)[number];

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const raw = String(params.plan ?? "").toLowerCase();
  const plan = VALID_PLANS.includes(raw as Plan) ? (raw as Plan) : undefined;

  return <SignupForm plan={plan} />;
}