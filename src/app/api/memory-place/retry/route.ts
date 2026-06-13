import { NextRequest, NextResponse } from "next/server";
import { runMemoryGeneration } from "@/lib/memory-generation";
import { getMemoryPlace, setMemoryPlace } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const { uid, place_id } = await request.json();

    if (!uid || !place_id) {
      return NextResponse.json(
        { error: "uid and place_id are required" },
        { status: 400 }
      );
    }

    const record = await getMemoryPlace(uid, place_id);
    if (!record) {
      return NextResponse.json({ error: "Memory place not found" }, { status: 404 });
    }

    if (record.world_status === "generating") {
      return NextResponse.json({
        place_id,
        world_status: "generating" as const,
      });
    }

    await setMemoryPlace(uid, {
      ...record,
      pano_status: "generating",
      world_status: "not_started",
      world_operation_id: null,
      world_id: null,
      spz_url: null,
    });

    void runMemoryGeneration(
      uid,
      place_id,
      record.source_photo_url,
      record.place_name,
      `A realistic navigable interior of ${record.place_name}, suitable for language learning vocabulary practice.`
    );

    return NextResponse.json({
      place_id,
      world_status: "generating" as const,
    });
  } catch (e) {
    console.error("memory-place retry error:", e);
    return NextResponse.json(
      { error: "Failed to retry generation" },
      { status: 500 }
    );
  }
}
