import { createClient } from "@/lib/supabase/server";
import { MenuClient } from "@/components/menu/menu-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  return {
    title: "Digital Menu",
    description: "View our menu and place your order",
    robots: "noindex, nofollow",
  };
}

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { restaurantId } = await params;
  const { table } = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_menu", {
    p_restaurant: restaurantId,
  });

  if (error || !data || data.error) {
    notFound();
  }

  return (
    <MenuClient
      categories={data.categories ?? []}
      products={data.products ?? []}
      tables={data.tables ?? []}
      restaurantName={data.restaurant?.name ?? "Our Restaurant"}
      restaurantId={restaurantId}
      preselectedTableId={table}
    />
  );
}