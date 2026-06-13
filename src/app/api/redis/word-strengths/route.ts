import { NextRequest, NextResponse } from "next/server";
import { getAllWordStrengths } from "@/lib/redis";
import { WordStrength } from "@/lib/types";

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  const wordIds =
    request.nextUrl.searchParams
      .get("word_ids")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? [];

  if (!uid || wordIds.length === 0) {
    return NextResponse.json(
      { error: "uid and word_ids are required" },
      { status: 400 }
    );
  }

  const stored = await getAllWordStrengths(uid, wordIds);
  const byId = new Map(stored.map((ws) => [ws.word_id, ws]));

  const strengths: WordStrength[] = wordIds.map(
    (word_id) =>
      byId.get(word_id) ?? {
        word_id,
        strength: 0.5,
        due_ts: Date.now(),
        seen: 0,
        correct: 0,
        wrong: 0,
      }
  );

  return NextResponse.json({ strengths });
}
