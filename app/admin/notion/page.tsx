import type { Metadata } from "next";
import { NotionIntegrationClient } from "@/components/notion/notion-integration-client";

export const metadata: Metadata = {
  title: "Notion Integration",
};

export default function AdminNotionPage() {
  return (
    <NotionIntegrationClient
      defaultMarketingDb={process.env.NOTION_MARKETING_DB}
      defaultFeedbackDb={process.env.NOTION_FEEDBACK_DB}
      defaultChangelogDb={process.env.NOTION_CHANGELOG_DB}
    />
  );
}

