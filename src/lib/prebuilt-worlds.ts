import { MemoryPlaceRecord } from "./types";

export type PrebuiltWorldKey = "station" | "pret" | "bakery";

export interface PrebuiltWorld {
  key: PrebuiltWorldKey;
  place_id: string;
  place_name: string;
  unit_id: string;
  world_id: string;
  /** Local or Marble CDN splat URL when generated. */
  spz_url?: string | null;
  /** Fallback panorama while splat is generating. */
  pano_url?: string | null;
}

export const PREBUILT_WORLDS: PrebuiltWorld[] = [
  {
    key: "station",
    place_id: "ChIJq67u0E0bdkgR5V9Q4wY8q-M",
    place_name: "London King's Cross Station",
    unit_id: "gare_1",
    world_id: "gare_fr",
  },
  {
    key: "pret",
    place_id: "ChIJ53bz-TsbdkgRMO_6tzdHxso",
    place_name: "Pret A Manger, King's Cross",
    unit_id: "cafe_1",
    world_id: "cafe_fr",
  },
  {
    key: "bakery",
    place_id: "ChIJ66fJmI0bdkgRyK6cWw9w9p8",
    place_name: "GAIL's Bakery King's Cross",
    unit_id: "boulangerie_1",
    world_id: "boulangerie_fr",
  },
];

const byKey = new Map(PREBUILT_WORLDS.map((w) => [w.key, w]));
const byUnitId = new Map(PREBUILT_WORLDS.map((w) => [w.unit_id, w]));

export function getPrebuiltWorld(key: PrebuiltWorldKey): PrebuiltWorld {
  const world = byKey.get(key);
  if (!world) throw new Error(`Unknown prebuilt world: ${key}`);
  return world;
}

export function getPrebuiltWorldForUnit(unitId: string): PrebuiltWorld | null {
  return byUnitId.get(unitId) ?? null;
}

export function toMemoryPlaceRecord(world: PrebuiltWorld): MemoryPlaceRecord {
  const hasSplat = Boolean(world.spz_url);
  return {
    place_id: world.place_id,
    place_name: world.place_name,
    unit_id: world.unit_id,
    source_photo_url: world.pano_url ?? "",
    address: "King's Cross, London",
    pano_url: world.pano_url ?? null,
    pano_status: world.pano_url || hasSplat ? "ready" : "generating",
    spz_url: world.spz_url ?? null,
    world_status: hasSplat ? "ready" : "not_started",
    world_operation_id: null,
    world_id: world.world_id,
    created_at: new Date().toISOString(),
  };
}

/** Prefer memory place when we have splat/pano assets; otherwise built-in splat world. */
export function resolvePrebuiltEntryUrl(world: PrebuiltWorld): string {
  if (world.spz_url || world.pano_url) {
    return `/memory/${encodeURIComponent(world.place_id)}`;
  }
  return `/world/${world.world_id}`;
}
