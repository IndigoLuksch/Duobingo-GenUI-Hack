import prebuiltOverrides from "../../data/prebuilt-worlds.json";
import {
  getPrebuiltWorld,
  PrebuiltWorld,
  PrebuiltWorldKey,
  PREBUILT_WORLDS,
  resolvePrebuiltEntryUrl,
  toMemoryPlaceRecord,
} from "./prebuilt-worlds";
import { getMemoryPlace, setMemoryPlace } from "./redis";
import { MemoryPlaceRecord } from "./types";

type OverrideEntry = {
  key: PrebuiltWorldKey;
  spz_url?: string | null;
  pano_url?: string | null;
};

function withOverrides(world: PrebuiltWorld): PrebuiltWorld {
  const override = (prebuiltOverrides.worlds as OverrideEntry[]).find(
    (entry) => entry.key === world.key
  );
  if (!override) return world;
  return {
    ...world,
    spz_url: override.spz_url ?? world.spz_url,
    pano_url: override.pano_url ?? world.pano_url,
  };
}

export function getResolvedPrebuiltWorld(key: PrebuiltWorldKey): PrebuiltWorld {
  return withOverrides(getPrebuiltWorld(key));
}

export function getAllResolvedPrebuiltWorlds(): PrebuiltWorld[] {
  return PREBUILT_WORLDS.map(withOverrides);
}

export async function ensurePrebuiltWorld(
  uid: string,
  key: PrebuiltWorldKey
): Promise<{ url: string; record: MemoryPlaceRecord }> {
  const world = getResolvedPrebuiltWorld(key);
  const record = toMemoryPlaceRecord(world);

  const existing = await getMemoryPlace(uid, world.place_id);
  if (existing?.spz_url || existing?.pano_url) {
    return {
      url: resolvePrebuiltEntryUrl({
        ...world,
        spz_url: existing.spz_url,
        pano_url: existing.pano_url,
      }),
      record: existing,
    };
  }

  await setMemoryPlace(uid, record);
  return { url: resolvePrebuiltEntryUrl(world), record };
}

export async function seedAllPrebuiltWorlds(uid: string): Promise<void> {
  for (const world of getAllResolvedPrebuiltWorlds()) {
    await setMemoryPlace(uid, toMemoryPlaceRecord(world));
  }
}
