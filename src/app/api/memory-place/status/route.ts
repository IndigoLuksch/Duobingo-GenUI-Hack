import { NextRequest, NextResponse } from "next/server";
import { refreshMemoryPlaceFromMarble } from "@/lib/memory-generation";
import { getMemoryPlace } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  const placeId = request.nextUrl.searchParams.get("place_id");

  if (!uid || !placeId) {
    return NextResponse.json(
      { error: "uid and place_id are required" },
      { status: 400 }
    );
  }

  await refreshMemoryPlaceFromMarble(uid, placeId);
  const record = await getMemoryPlace(uid, placeId);

  if (!record) {
    return NextResponse.json({ error: "Memory place not found" }, { status: 404 });
  }

  return NextResponse.json({
    pano_status: record.pano_status,
    pano_url: record.pano_url,
    world_status: record.world_status,
    spz_url: record.spz_url,
    place_name: record.place_name,
    unit_id: record.unit_id,
    world_operation_id: record.world_operation_id,
    world_id: record.world_id,
    source_photo_url: record.source_photo_url,
  });
}
