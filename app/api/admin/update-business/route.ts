import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { id, is_active } = await request.json();
    if (!id || is_active === undefined) {
      return NextResponse.json(
        { ok: false, error: "Missing business id or is_active" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_platform_admin) {
      return NextResponse.json({ ok: false, error: "Not a platform admin" }, { status: 403 });
    }

    // Direct UPDATE needs migration 007's RLS policy. Fall back to the
    // service role key admin client if the policy isn't applied on the live DB.
    const { error } = await supabase
      .from("businesses")
      .update({ is_active })
      .eq("id", id);

    if (!error) {
      return NextResponse.json({ ok: true, is_active });
    }

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: `businesses update error: ${error.message}. Tip: run migration-007 in Supabase SQL Editor and NOTIFY pgrst, 'reload schema';` },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(serviceUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: adminError } = await adminClient
      .from("businesses")
      .update({ is_active })
      .eq("id", id);

    if (adminError) {
      return NextResponse.json({ ok: false, error: adminError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, is_active });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}