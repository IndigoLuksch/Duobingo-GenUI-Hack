import { NextRequest, NextResponse } from "next/server";
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

  const record = await getMemoryPlace(uid, placeId);
  if (!record?.source_photo_url) {
    return NextResponse.json({ error: "Panorama not found" }, { status: 404 });
  }

  const imageRes = await fetch(record.source_photo_url);
  if (!imageRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch Street View image" },
      { status: 502 }
    );
  }

  const buffer = await imageRes.arrayBuffer();
  const contentType = imageRes.headers.get("content-type") || "image/jpeg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
