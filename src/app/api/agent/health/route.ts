import { NextResponse } from "next/server";
import { getLessonAgentBaseUrl } from "@/lib/agent-config";

export async function GET() {
  const agentUrl = getLessonAgentBaseUrl();

  try {
    const res = await fetch(`${agentUrl}/docs`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, agentUrl, status: res.status },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true, agentUrl });
  } catch {
    return NextResponse.json(
      { ok: false, agentUrl, error: "unreachable" },
      { status: 503 }
    );
  }
}
