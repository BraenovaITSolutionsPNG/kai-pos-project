import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { path, visitorId } = body;

    const supabase = await createClient();
    await supabase.from("page_views").insert({
      path: path || "/",
      visitor_id: visitorId || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

