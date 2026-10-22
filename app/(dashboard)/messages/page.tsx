import type { Metadata } from "next";
import { getSessionContext } from "@/lib/queries";
import { assertAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { MessagesClient, type ContactMessage } from "@/components/admin/messages-client";

export const metadata: Metadata = {
  title: "Messages",
};

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const ctx = await getSessionContext();
  assertAccess(ctx.staff.role, "/messages");

  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  return <MessagesClient initialMessages={(data ?? []) as ContactMessage[]} />;
}