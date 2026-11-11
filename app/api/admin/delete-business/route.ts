import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing business id" }, { status: 400 });
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

    // Try the RPC first (migration 046). Falls back to the service role key
    // admin client if the RPC is missing from the live schema cache.
    const { error } = await supabase.rpc("delete_business", { business_id: id });

    if (!error) {
      return NextResponse.json({ ok: true });
    }

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceUrl || !serviceKey) {
      return NextResponse.json(
        {
          ok: false,
          error: `delete_business RPC error: ${error.message}. Tip: run migration-046 in Supabase SQL Editor and NOTIFY pgrst, 'reload schema';`,
        },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(serviceUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: deleted, error: adminError } = await adminClient
      .from("businesses")
      .delete()
      .eq("id", id)
      .select("id");

    if (adminError) {
      return NextResponse.json({ ok: false, error: adminError.message }, { status: 500 });
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ ok: false, error: "Business not found or already deleted" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}