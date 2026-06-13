import { NextRequest, NextResponse } from "next/server";
import { fetchAuthenticSentence } from "@/lib/linkup";

export async function POST(req: NextRequest) {
  try {
    const { word, translation } = await req.json();

    if (!word || !translation) {
      return NextResponse.json({ sentence: null, source: null });
    }

    const result = await fetchAuthenticSentence(word, translation);
    return NextResponse.json({
      sentence: result?.sentence ?? null,
      source: result?.source ?? null,
    });
  } catch {
    return NextResponse.json({ sentence: null, source: null });
  }
}
