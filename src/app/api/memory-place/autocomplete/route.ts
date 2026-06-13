import { NextRequest, NextResponse } from "next/server";
import { autocompletePlaces } from "@/lib/google-places";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input")?.trim() ?? "";

  if (input.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({
      suggestions: [],
      error: "Google Places API key is not configured.",
    });
  }

  try {
    const suggestions = await autocompletePlaces(input);
    return NextResponse.json({ suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Places search failed";
    return NextResponse.json({ suggestions: [], error: message });
  }
}
