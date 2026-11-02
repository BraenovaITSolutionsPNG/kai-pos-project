import type { Metadata } from "next";
import { NotionIntegrationClient } from "@/components/notion/notion-integration-client";
import { getSessionContext } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Notion Integration",
};

export default async function NotionPage() {
  const ctx = await getSessionContext();
  
  return <NotionIntegrationClient />;
}
