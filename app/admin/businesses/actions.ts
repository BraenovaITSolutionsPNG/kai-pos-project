"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteBusinessAction(id: string): Promise<{ ok: boolean; error?: string; debug?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated", debug: "no user" };
  }

  // Check if business exists
  const { data: biz, error: fetchErr } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", id)
    .single();

  if (fetchErr || !biz) {
    return { ok: false, error: "Business not found", debug: `fetchErr=${fetchErr?.message} id=${id}` };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return { ok: false, error: "Not a platform admin", debug: `user=${user.id} admin=${profile?.is_platform_admin}` };
  }

  const { error, count } = await supabase
    .from("businesses")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message, debug: `delete error: ${error.code} ${error.details}` };
  }
  if (count === 0) {
    return { ok: false, error: "Delete returned 0 rows", debug: `user=${user.id} biz=${biz.name} count=${count}` };
  }
  revalidatePath("/admin/businesses");
  return { ok: true, debug: `deleted ${count} row(s): ${biz.name}` };
}
