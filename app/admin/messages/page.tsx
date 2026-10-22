import type { Metadata } from "next";
import { MessagesClient } from "@/components/admin/messages-client";
import { getAdminMessages } from "@/lib/queries";
import { requirePlatformAdmin } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Messages",
};

export default async function MessagesPage() {
  await requirePlatformAdmin();
  const messages = await getAdminMessages();

  return <MessagesClient messages={messages} />;
}