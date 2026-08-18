import type { Metadata } from "next";
import { SubscriptionsClient } from "@/components/admin/subscriptions-client";
import {
  getAdminSubscriptionPayments,
  getAdminSubscriptions,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "Subscriptions",
};

export default async function AdminSubscriptionsPage() {
  const subscriptions = await getAdminSubscriptions();

  const payments = await Promise.all(
    subscriptions.map((s) =>
      getAdminSubscriptionPayments(s.id).then((p) => ({ id: s.id, payments: p }))
    )
  );
  const paymentsBySub = new Map(payments.map((p) => [p.id, p.payments]));

  return (
    <SubscriptionsClient
      subscriptions={subscriptions}
      paymentsBySub={Object.fromEntries(paymentsBySub)}
    />
  );
}