import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMySqlMode } from "@/lib/supabase/env";
import { authGetUser } from "@/lib/mysql/executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const MAX_SIZE = 4 * 1024 * 1024;
const BUCKET = "payment-proofs";

export async function POST(request: Request) {
  try {
    if (isMySqlMode()) {
      const { data: auth } = await authGetUser();
      if (!auth.user) {
        return NextResponse.json(
          { data: null, error: { message: "Unauthorized" } },
          { status: 401 }
        );
      }
    } else {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { data: null, error: { message: "Unauthorized" } },
          { status: 401 }
        );
      }
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { data: null, error: { message: "No file provided" } },
        { status: 400 }
      );
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { data: null, error: { message: "Only image files are allowed" } },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { data: null, error: { message: "Image must be 4MB or smaller" } },
        { status: 400 }
      );
    }

    if (isMySqlMode()) {
      // Local MySQL mode: keep files on disk.
      const name = `${randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
      return NextResponse.json({ data: { url: `/uploads/${name}` }, error: null });
    }

    const supabase = await createClient();
    const name = `${(await supabase.auth.getUser()).data.user!.id}/${randomUUID()}${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(name, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json(
        { data: null, error: { message: uploadError.message } },
        { status: 500 }
      );
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return NextResponse.json({ data: { url: pub.publicUrl }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload error";
    return NextResponse.json(
      { data: null, error: { message } },
      { status: 500 }
    );
  }
}
