import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Online Order",
};

export default async function OnlineOrderRedirect() {
  const supabase = await createClient();
  const { data } = await supabase.from("restaurants").select("id").limit(1).single();
  if (data?.id) {
    redirect(`/order/${data.id}`);
  }
  return <div className="flex items-center justify-center min-h-screen"><p>No restaurants available</p></div>;
}

