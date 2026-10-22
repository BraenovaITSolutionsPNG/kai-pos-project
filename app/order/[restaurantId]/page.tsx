import { createClient } from "@/lib/supabase/server";
import { OrderClient } from "@/components/order/order-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  void restaurantId;
  return {
    title: "Order Online",
    description: "Order for pickup or delivery",
    robots: "noindex, nofollow",
  };
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_menu", {
    p_restaurant: restaurantId,
  });

  if (error || !data || data.error) {
    notFound();
  }

  return (
    <OrderClient
      categories={data.categories ?? []}
      products={data.products ?? []}
      promotions={data.promotions ?? []}
      restaurantName={data.restaurant?.name ?? "Our Restaurant"}
      restaurantId={restaurantId}
      restaurantPhone={data.restaurant?.phone ?? null}
      restaurantAddress={data.restaurant?.address ?? null}
    />
  );
}