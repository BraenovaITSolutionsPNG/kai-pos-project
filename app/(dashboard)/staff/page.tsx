import type { Metadata } from "next";
import { StaffClient } from "@/components/staff/staff-client";
import { getSessionContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { assertAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Staff",
};

export default async function StaffPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/staff");
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("restaurant_id", ctx.restaurant.id);

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .in(
      "id",
      (staff ?? []).map((s) => s.user_id)
    );

  const userById = new Map((users ?? []).map((u) => [u.id, u]));
  const rows = (staff ?? []).map((s) => ({
    ...s,
    user_email: userById.get(s.user_id)?.email ?? "",
    user_name: userById.get(s.user_id)?.full_name ?? "",
  }));

  return (
    <StaffClient
      staff={rows}
      currentRole={ctx.staff.role}
      currentUserId={ctx.user.id}
    />
  );
}