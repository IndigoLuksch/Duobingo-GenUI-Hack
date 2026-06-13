import { NextRequest, NextResponse } from "next/server";
import { getWordStrength, setWordStrength } from "@/lib/redis";
import { applyCorrect, applyWrong } from "@/lib/srs";
import { WordStrength } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { uid, word_id, result } = await request.json();

  if (!uid || !word_id || !result) {
    return NextResponse.json({ error: "uid, word_id, and result are required" }, { status: 400 });
  }

  let ws = await getWordStrength(uid, word_id);

  if (!ws) {
    ws = {
      word_id,
      strength: 0.5,
      due_ts: Date.now(),
      seen: 0,
      correct: 0,
      wrong: 0,
    };
  }

  const updated: WordStrength =
    result === "boost" ? applyCorrect(ws, "world") : applyWrong(ws, "world");

  await setWordStrength(uid, updated);

  return NextResponse.json({
    word_id,
    new_strength: updated.strength,
  });
}
