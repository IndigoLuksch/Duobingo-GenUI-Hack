import { NextRequest, NextResponse } from "next/server";
import { setMemoryPlace } from "@/lib/redis";
import { MemoryPlaceRecord } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { uid, record } = (await request.json()) as {
      uid?: string;
      record?: MemoryPlaceRecord;
    };

    if (!uid || !record?.place_id) {
      return NextResponse.json(
        { error: "uid and record.place_id are required" },
        { status: 400 }
      );
    }

    await setMemoryPlace(uid, record);

    return NextResponse.json({
      success: true,
      place_id: record.place_id,
      pano_status: record.pano_status,
      world_status: record.world_status,
      has_spz: Boolean(record.spz_url),
    });
  } catch (e) {
    console.error("memory-place import error:", e);
    return NextResponse.json(
      { error: "Failed to import memory place" },
      { status: 500 }
    );
  }
}
