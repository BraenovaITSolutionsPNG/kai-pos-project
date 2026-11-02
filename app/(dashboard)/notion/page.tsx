import type { Metadata } from "next";
import { NotionIntegrationClient } from "@/components/notion/notion-integration-client";
import { getSessionContext } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Notion Integration",
};

export default async function NotionPage() {
  const ctx = await getSessionContext();

  return (
    <NotionIntegrationClient
      defaultMarketingDb={process.env.NOTION_MARKETING_DB}
      defaultFeedbackDb={process.env.NOTION_FEEDBACK_DB}
      defaultChangelogDb={process.env.NOTION_CHANGELOG_DB}
    />
  );
}

