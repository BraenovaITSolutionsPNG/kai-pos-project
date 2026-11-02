import type { Metadata } from "next";
import { OnlineOrderClient } from "@/components/online-order/online-order-client";

export const metadata: Metadata = {
  title: "Online Order",
};

export default function OnlineOrderPage() {
  return <OnlineOrderClient />;
}

