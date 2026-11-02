import "server-only";
import { notion } from "./client";

export interface MarketingContent {
  id: string;
  title: string;
  type: "page" | "post" | "copy";
  status?: string;
  url?: string;
  lastEditedTime?: string;
}

export interface ClientFeedback {
  id: string;
  title: string;
  clientName?: string;
  restaurantName?: string;
  feedback?: string;
  status: "new" | "reviewing" | "planned" | "in-progress" | "done" | "rejected";
  priority: "low" | "medium" | "high" | "critical";
  url?: string;
  createdTime?: string;
}

export interface ChangelogEntry {
  id: string;
  title: string;
  version?: string;
  type: "feature" | "fix" | "improvement" | "breaking" | "security";
  description?: string;
  releasedAt?: string;
  url?: string;
}

export async function getMarketingContent(databaseId?: string): Promise<MarketingContent[]> {
  if (!databaseId) return [];
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    return response.results.map((page: any) => ({
      id: page.id,
      title: page.properties.Name?.title?.[0]?.plain_text || page.properties.Title?.title?.[0]?.plain_text || "Untitled",
      type: page.properties.Type?.select?.name || "page",
      status: page.properties.Status?.status?.name || page.properties.Status?.select?.name,
      url: page.url,
      lastEditedTime: page.last_edited_time,
    }));
  } catch (error) {
    console.error("Error fetching marketing content:", error);
    return [];
  }
}

export async function getClientFeedback(databaseId?: string): Promise<ClientFeedback[]> {
  if (!databaseId) return [];
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          property: "Created",
          direction: "descending",
        },
      ],
    });

    return response.results.map((page: any) => ({
      id: page.id,
      title: page.properties.Name?.title?.[0]?.plain_text || "Untitled",
      clientName: page.properties["Client Name"]?.rich_text?.[0]?.plain_text || page.properties.Client?.rich_text?.[0]?.plain_text,
      restaurantName: page.properties["Restaurant Name"]?.rich_text?.[0]?.plain_text || page.properties.Restaurant?.rich_text?.[0]?.plain_text,
      feedback: page.properties.Feedback?.rich_text?.[0]?.plain_text,
      status: page.properties.Status?.select?.name || "new",
      priority: page.properties.Priority?.select?.name || "medium",
      url: page.url,
      createdTime: page.created_time,
    }));
  } catch (error) {
    console.error("Error fetching client feedback:", error);
    return [];
  }
}

export async function getChangelog(databaseId?: string): Promise<ChangelogEntry[]> {
  if (!databaseId) return [];
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          property: "Released",
          direction: "descending",
        },
      ],
    });

    return response.results.map((page: any) => ({
      id: page.id,
      title: page.properties.Name?.title?.[0]?.plain_text || page.properties.Title?.title?.[0]?.plain_text || "Untitled",
      version: page.properties.Version?.rich_text?.[0]?.plain_text,
      type: page.properties.Type?.select?.name || "feature",
      description: page.properties.Description?.rich_text?.[0]?.plain_text,
      releasedAt: page.properties.Released?.date?.start,
      url: page.url,
    }));
  } catch (error) {
    console.error("Error fetching changelog:", error);
    return [];
  }
}

export async function createClientFeedback(databaseId: string, data: {
  title: string;
  clientName?: string;
  restaurantName?: string;
  feedback: string;
  priority?: "low" | "medium" | "high" | "critical";
}) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: data.title,
              },
            },
          ],
        },
        ...(data.clientName && {
          "Client Name": {
            rich_text: [
              {
                text: {
                  content: data.clientName,
                },
              },
            ],
          },
        }),
        ...(data.restaurantName && {
          "Restaurant Name": {
            rich_text: [
              {
                text: {
                  content: data.restaurantName,
                },
              },
            ],
          },
        }),
        Feedback: {
          rich_text: [
            {
              text: {
                content: data.feedback,
              },
            },
          ],
        },
        Priority: {
          select: {
            name: data.priority || "medium",
          },
        },
        Status: {
          select: {
            name: "new",
          },
        },
      },
    });
    return response;
  } catch (error) {
    console.error("Error creating client feedback:", error);
    throw error;
  }
}
