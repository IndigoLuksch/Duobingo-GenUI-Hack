import { NextRequest, NextResponse } from "next/server";
import { setWordStrength } from "@/lib/redis";

export async function POST(request: NextRequest) {
  const { uid, word_id } = await request.json();

  if (!uid || !word_id) {
    return NextResponse.json({ error: "uid and word_id are required" }, { status: 400 });
  }

  await setWordStrength(uid, {
    word_id,
    strength: 0.3,
    due_ts: Date.now(),
    seen: 0,
    correct: 0,
    wrong: 0,
  });

  return NextResponse.json({ success: true });
}
