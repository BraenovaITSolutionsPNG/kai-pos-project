import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getSiteContent,
  getMySubscription,
  getMyPayments,
} from "@/lib/queries";
import { resolveSiteContent } from "@/lib/site-content";
import { SubscriptionClient } from "@/components/subscription/subscription-client";

export const metadata: Metadata = {
  title: "Subscription & payment",
};

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [subscription, payments, rows] = await Promise.all([
    getMySubscription(),
    getMyPayments(),
    getSiteContent(),
  ]);
  const content = resolveSiteContent(rows);

  if (!subscription) redirect("/dashboard");

  // Only show the payment page when it is needed: a new signup awaiting
  // approval, or a plan that has lapsed. Once a payment is approved the
  // subscription is active, so send the owner back to the app.
  if (subscription.status === "active") redirect("/dashboard");

  return (
    <SubscriptionClient
      subscription={subscription}
      payments={payments}
      bankDetails={content.bank_details}
    />
  );
}