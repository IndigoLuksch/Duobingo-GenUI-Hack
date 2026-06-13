import { NextRequest, NextResponse } from "next/server";
import { runMemoryGeneration } from "@/lib/memory-generation";
import { setMemoryPlace } from "@/lib/redis";
import { MemoryPlaceRecord } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { uid, place_id, place_name, photo_url, unit_id } =
      await request.json();

    if (!uid || !place_id || !photo_url || !unit_id) {
      return NextResponse.json(
        { error: "uid, place_id, photo_url, and unit_id are required" },
        { status: 400 }
      );
    }

    const record: MemoryPlaceRecord = {
      place_id,
      place_name: place_name ?? place_id,
      unit_id,
      source_photo_url: photo_url,
      pano_url: null,
      pano_status: "generating",
      spz_url: null,
      world_status: "not_started",
      world_operation_id: null,
      world_id: null,
      created_at: new Date().toISOString(),
    };

    await setMemoryPlace(uid, record);

    void runMemoryGeneration(
      uid,
      place_id,
      photo_url,
      record.place_name,
      `A realistic navigable interior of ${record.place_name}, suitable for language learning vocabulary practice.`
    );

    return NextResponse.json({
      place_id,
      pano_status: "generating" as const,
    });
  } catch (e) {
    console.error("memory-place generate error:", e);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}
