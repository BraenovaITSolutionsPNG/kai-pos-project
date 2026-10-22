import { createClient } from "@/lib/supabase/server";
import { ShiftsClient } from "@/components/shifts/shifts-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  return {
    title: "Shift Schedule",
    description: "View our team's shift schedule",
    robots: "noindex, nofollow",
  };
}

export default async function ShiftsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .single();

  if (!restaurant) {
    notFound();
  }

  const { data: shifts, error } = await supabase
    .from("shift_schedules")
    .select("*, staff!inner (full_name, role)")
    .eq("restaurant_id", restaurantId)
    .order("schedule_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    notFound();
  }

  const shiftsByDate: Record<string, (typeof shifts)[number][]> = {};
  (shifts ?? []).forEach((shift) => {
    const date = shift.schedule_date;
    if (!shiftsByDate[date]) {
      shiftsByDate[date] = [];
    }
    shiftsByDate[date].push(shift);
  });

  return (
    <ShiftsClient
      restaurantName={restaurant.name}
      shiftsByDate={Object.entries(shiftsByDate).map(([date, shifts]) => ({
        date,
        shifts,
      }))}
    />
  );
}