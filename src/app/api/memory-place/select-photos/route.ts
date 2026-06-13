import { NextRequest, NextResponse } from "next/server";
import {
  downloadPhotoAsBase64,
  fetchPlaceDetails,
} from "@/lib/google-places";
import { rankPhotosWithGemini } from "@/lib/photo-ranking";

export async function POST(request: NextRequest) {
  try {
    const { place_id, place_name } = await request.json();

    if (!place_id) {
      return NextResponse.json(
        { error: "place_id is required" },
        { status: 400 }
      );
    }

    const details = await fetchPlaceDetails(place_id, place_name);
    if (!details || details.photos.length === 0) {
      return NextResponse.json(
        { error: "No photos found for this place" },
        { status: 404 }
      );
    }

    const photoData = (
      await Promise.all(
        details.photos.map((p) => downloadPhotoAsBase64(p.url))
      )
    ).filter((d): d is { base64: string; mimeType: string } => d !== null);

    const ranked_photos = await rankPhotosWithGemini(
      details.place_name,
      details.photos,
      photoData
    );

    return NextResponse.json({
      place_name: details.place_name,
      address: details.address,
      ranked_photos,
    });
  } catch (e) {
    console.error("select-photos error:", e);
    return NextResponse.json(
      { error: "Failed to select photos" },
      { status: 500 }
    );
  }
}
