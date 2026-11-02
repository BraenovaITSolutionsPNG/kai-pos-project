import { NextResponse } from "next/server";
import { createClientFeedback } from "@/lib/notion/queries";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { feedbackDb, ...data } = body;

    if (!feedbackDb) {
      return NextResponse.json({ error: "Missing feedbackDb" }, { status: 400 });
    }

    if (!data.title || !data.feedback) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await createClientFeedback(feedbackDb, data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Notion create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
