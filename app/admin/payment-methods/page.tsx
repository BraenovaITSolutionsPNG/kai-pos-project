import type { Metadata } from "next";
import { PaymentMethodsAdminClient } from "@/components/admin/payment-methods-admin-client";
import { getSessionContext } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Payment Methods",
};

export default async function PaymentMethodsAdminPage() {
  const ctx = await getSessionContext();
  return <PaymentMethodsAdminClient />;
}

