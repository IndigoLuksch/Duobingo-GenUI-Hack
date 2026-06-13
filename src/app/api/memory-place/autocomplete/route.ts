import { NextRequest, NextResponse } from "next/server";
import { autocompletePlaces } from "@/lib/google-places";
import { getPlaceTypesForUnit } from "@/lib/place-types";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input")?.trim() ?? "";
  const unitId = request.nextUrl.searchParams.get("unit_id") ?? undefined;
  const unitTitle = request.nextUrl.searchParams.get("unit_title") ?? undefined;

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
    const placeTypes = unitId
      ? getPlaceTypesForUnit(unitId, unitTitle)
      : undefined;
    const suggestions = await autocompletePlaces(input, placeTypes);
    return NextResponse.json({ suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Places search failed";
    return NextResponse.json({ suggestions: [], error: message });
  }
}
