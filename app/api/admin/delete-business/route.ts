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
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.rpc("delete_business", { business_id: id });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, debug: `rpc err: ${error.code} ${error.details}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, debug: "deleted via RPC" });
}
