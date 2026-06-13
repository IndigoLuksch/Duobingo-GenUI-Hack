import { NextRequest, NextResponse } from "next/server";
import { fetchPlaceLocation } from "@/lib/google-places";
import { resolveStreetViewForPlace } from "@/lib/google-streetview";
import { runCustomWorldGeneration } from "@/lib/memory-generation";
import { COURSES, CourseId } from "@/lib/courses";
import { setMemoryPlace } from "@/lib/redis";
import { MemoryPlaceRecord } from "@/lib/types";

function customPlaceId(googlePlaceId: string): string {
  return `sv-${googlePlaceId}`;
}

export async function POST(request: NextRequest) {
  try {
    const { uid, place_id, place_name, course_id } = await request.json();

    if (!uid || !place_id) {
      return NextResponse.json(
        { error: "uid and place_id are required" },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_PLACES_API_KEY && !process.env.GOOGLE_MAPS_API_KEY) {
      return NextResponse.json(
        { error: "Google Maps API key is not configured." },
        { status: 503 }
      );
    }

    const location = await fetchPlaceLocation(place_id);
    if (!location) {
      return NextResponse.json(
        { error: "Could not find coordinates for this location." },
        { status: 404 }
      );
    }

    const streetView = await resolveStreetViewForPlace(
      location.lat,
      location.lng
    );
    if (!streetView) {
      return NextResponse.json(
        {
          error:
            "No Google Street View coverage at this location. Try a different spot.",
        },
        { status: 404 }
      );
    }

    const course =
      course_id && course_id in COURSES
        ? COURSES[course_id as CourseId]
        : COURSES.fr;
    const unitId = course.units[0]?.unit_id;
    if (!unitId) {
      return NextResponse.json(
        { error: "No course units available." },
        { status: 500 }
      );
    }

    const recordId = customPlaceId(place_id);
    const displayName = place_name ?? place_id;
    const panoProxyUrl = `/api/custom-world/pano?uid=${encodeURIComponent(uid)}&place_id=${encodeURIComponent(recordId)}`;

    const record: MemoryPlaceRecord = {
      place_id: recordId,
      place_name: displayName,
      unit_id: unitId,
      source: "street_view",
      source_photo_url: streetView.imageUrl,
      pano_url: panoProxyUrl,
      pano_status: "ready",
      spz_url: null,
      world_status: "not_started",
      world_operation_id: null,
      world_id: null,
      created_at: new Date().toISOString(),
    };

    await setMemoryPlace(uid, record);

    void runCustomWorldGeneration(
      uid,
      recordId,
      streetView.imageUrl,
      displayName,
      `A realistic navigable 3D scene of ${displayName} as seen from Google Street View, suitable for language learning vocabulary practice.`
    );

    return NextResponse.json({
      place_id: recordId,
      pano_status: "ready" as const,
      world_status: "generating" as const,
      url: `/memory/${encodeURIComponent(recordId)}`,
    });
  } catch (e) {
    console.error("custom-world generate error:", e);
    return NextResponse.json(
      { error: "Failed to start world generation" },
      { status: 500 }
    );
  }
}
