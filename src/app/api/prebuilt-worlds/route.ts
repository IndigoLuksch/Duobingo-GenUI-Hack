import { NextRequest, NextResponse } from "next/server";
import {
  ensurePrebuiltWorld,
  getAllResolvedPrebuiltWorlds,
} from "@/lib/prebuilt-worlds-server";
import { PrebuiltWorldKey } from "@/lib/prebuilt-worlds";
import { resolvePrebuiltEntryUrl } from "@/lib/prebuilt-worlds";

const VALID_KEYS = new Set<PrebuiltWorldKey>(["station", "pret", "bakery"]);

export async function GET() {
  const worlds = getAllResolvedPrebuiltWorlds().map((world) => ({
    key: world.key,
    place_name: world.place_name,
    unit_id: world.unit_id,
    url: resolvePrebuiltEntryUrl(world),
    has_splat: Boolean(world.spz_url),
    has_pano: Boolean(world.pano_url),
  }));
  return NextResponse.json({ worlds });
}

export async function POST(request: NextRequest) {
  try {
    const { uid = "demo", key } = (await request.json()) as {
      uid?: string;
      key?: string;
    };

    if (!key || !VALID_KEYS.has(key as PrebuiltWorldKey)) {
      return NextResponse.json(
        { error: "key must be one of: station, pret, bakery" },
        { status: 400 }
      );
    }

    const result = await ensurePrebuiltWorld(uid, key as PrebuiltWorldKey);
    return NextResponse.json({
      url: result.url,
      place_id: result.record.place_id,
      place_name: result.record.place_name,
      unit_id: result.record.unit_id,
    });
  } catch (e) {
    console.error("prebuilt-worlds ensure error:", e);
    return NextResponse.json(
      { error: "Failed to prepare prebuilt world" },
      { status: 500 }
    );
  }
}
