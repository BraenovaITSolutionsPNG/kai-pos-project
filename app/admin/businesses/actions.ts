"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteBusinessAction(id: string): Promise<{ ok: boolean; error?: string; debug?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated", debug: "no user session" };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  const { error, count } = await supabase
    .from("businesses")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message, debug: `user=${user.id} admin=${profile?.is_platform_admin} err=${error.code}` };
  }
  if (count === 0) {
    return { ok: false, error: "Delete returned 0 rows", debug: `user=${user.id} admin=${profile?.is_platform_admin} count=${count} id=${id}` };
  }
  revalidatePath("/admin/businesses");
  return { ok: true, debug: `deleted ${count} row(s)` };
}
