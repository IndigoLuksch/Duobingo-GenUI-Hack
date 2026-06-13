import { NextResponse } from "next/server";

export const runtime = "nodejs";

// CopilotKit 1.60+ polls this endpoint to list threads for an agent.
// We don't persist threads server-side, so always return an empty list.
export async function GET() {
  return NextResponse.json({ threads: [] });
}
