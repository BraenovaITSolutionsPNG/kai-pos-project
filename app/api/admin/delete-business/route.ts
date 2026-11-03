import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing business id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated", debug: "no user" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return NextResponse.json({ ok: false, error: "Not a platform admin", debug: `user=${user.id} admin=${profile?.is_platform_admin}` }, { status: 403 });
  }

  const { error, count } = await supabase
    .from("businesses")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, debug: `delete err: ${error.code}` }, { status: 500 });
  }
  if (count === 0) {
    return NextResponse.json({ ok: false, error: "Delete returned 0 rows", debug: `user=${user.id} admin=${profile?.is_platform_admin} count=${count} id=${id}` }, { status: 403 });
  }

  return NextResponse.json({ ok: true, debug: `deleted ${count} row(s)` });
}
