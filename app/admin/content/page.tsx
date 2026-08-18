import type { Metadata } from "next";
import { ContentClient } from "@/components/admin/content-client";
import { getSiteContent } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Landing page content",
};

export default async function AdminContentPage() {
  const rows = await getSiteContent();
  const content = Object.fromEntries(
    rows.map((r) => [r.id, r.value ?? {}])
  );

  return <ContentClient initial={content} />;
}