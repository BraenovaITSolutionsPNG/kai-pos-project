import { NextResponse } from "next/server";
import { getMarketingContent, getClientFeedback, getChangelog } from "@/lib/notion/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const marketingDb = searchParams.get("marketingDb");
  const feedbackDb = searchParams.get("feedbackDb");
  const changelogDb = searchParams.get("changelogDb");

  try {
    if (type === "marketing" && marketingDb) {
      const content = await getMarketingContent(marketingDb);
      return NextResponse.json({ content });
    }
    
    if (type === "feedback" && feedbackDb) {
      const feedback = await getClientFeedback(feedbackDb);
      return NextResponse.json({ feedback });
    }
    
    if (type === "changelog" && changelogDb) {
      const changelog = await getChangelog(changelogDb);
      return NextResponse.json({ changelog });
    }

    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  } catch (error) {
    console.error("Notion API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
