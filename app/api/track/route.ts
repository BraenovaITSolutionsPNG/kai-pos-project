import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { path, visitorId } = body as { path?: string; visitorId?: string };

    const supabase = await createClient();
    const { error } = await supabase.from("page_views").insert({
      path: path || "/",
      visitor_id: visitorId || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    if (error) {
      console.error("Page view insert error:", error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tracking error";
    console.error("Track error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
