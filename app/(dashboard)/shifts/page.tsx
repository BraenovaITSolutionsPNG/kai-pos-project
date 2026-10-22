import { createClient } from "@/lib/supabase/server";
import { ShiftsClient } from "@/components/shifts/shifts-client";
import { getSessionContext } from "@/lib/queries";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ShiftsDashboardPage() {
  const ctx = await getSessionContext();

  if (!ctx.restaurant.id) {
    redirect("/pos");
  }

  const supabase = await createClient();

  const { data: shifts, error } = await supabase
    .from("shift_schedules")
    .select("*, staff!inner (full_name, role)")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("schedule_date", { ascending: true })
    .order("start_time", { ascending: true });

const shiftsByDate: Record<string, Array<{
  id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  notes: string;
  staff: { full_name: string; role: string } | null;
}>> = {};
(shifts ?? []).forEach((shift) => {
  const date = shift.schedule_date;
  if (!shiftsByDate[date]) {
    shiftsByDate[date] = [];
  }
  shiftsByDate[date].push(shift);
});

  return (
    <ShiftsClient
      restaurantName={ctx.restaurant.name}
      shiftsByDate={Object.entries(shiftsByDate).map(([date, shifts]) => ({
        date,
        shifts,
      }))}
    />
  );
}