"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteBusinessAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("businesses")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }
  if (count === 0) {
    return { ok: false, error: "Delete blocked - no rows affected. Check admin permissions." };
  }
  revalidatePath("/admin/businesses");
  return { ok: true };
}
