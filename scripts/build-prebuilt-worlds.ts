/**
 * Generate Marble 3D worlds for the Kings Cross prebuilt venues and save URLs
 * to data/prebuilt-worlds.json + Redis.
 *
 * Usage:
 *   npx tsx scripts/build-prebuilt-worlds.ts [station|pret|bakery|all]
 *
 * Requires: GOOGLE_PLACES_API_KEY, WORLDLABS_API_KEY, REDIS_URL (optional)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import Redis from "ioredis";
import {
  PREBUILT_WORLDS,
  PrebuiltWorldKey,
  toMemoryPlaceRecord,
} from "../src/lib/prebuilt-worlds";
import { fetchPlaceDetails } from "../src/lib/google-places";
import { runMemoryGeneration } from "../src/lib/memory-generation";
import { getMemoryPlace } from "../src/lib/redis";

const envPath = resolve(process.cwd(), ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  /* optional */
}

const uid = "demo";
const target = (process.argv[2] ?? "all") as PrebuiltWorldKey | "all";
const dataPath = resolve(process.cwd(), "data/prebuilt-worlds.json");

type OverrideFile = {
  worlds: { key: PrebuiltWorldKey; spz_url: string | null; pano_url: string | null }[];
};

function loadOverrides(): OverrideFile {
  return JSON.parse(readFileSync(dataPath, "utf8")) as OverrideFile;
}

function saveOverrides(file: OverrideFile) {
  writeFileSync(dataPath, `${JSON.stringify(file, null, 2)}\n`);
}

async function waitForReady(placeId: string, timeoutMs = 12 * 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const record = await getMemoryPlace(uid, placeId);
    if (record?.spz_url) return record;
    if (record?.world_status === "not_started" && record.pano_status === "ready") {
      return record;
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  throw new Error(`Timed out waiting for world ${placeId}`);
}

async function buildOne(key: PrebuiltWorldKey) {
  const world = PREBUILT_WORLDS.find((w) => w.key === key);
  if (!world) throw new Error(`Unknown key: ${key}`);

  console.log(`\n=== ${world.place_name} (${key}) ===`);

  const details = await fetchPlaceDetails(world.place_id, world.place_name);
  if (!details?.photos[0]?.url) {
    throw new Error(`No photo for ${world.place_name}`);
  }

  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  const record = toMemoryPlaceRecord(world);
  record.source_photo_url = details.photos[0].url;
  record.address = details.address;
  await redis.set(
    `memory_place:${uid}:${world.place_id}`,
    JSON.stringify(record)
  );
  await redis.quit();

  await runMemoryGeneration(
    uid,
    world.place_id,
    details.photos[0].url,
    world.place_name,
    `A realistic navigable interior of ${world.place_name} at King's Cross, London, suitable for language learning.`
  );

  const ready = await waitForReady(world.place_id);
  const overrides = loadOverrides();
  const entry = overrides.worlds.find((w) => w.key === key);
  if (entry) {
    entry.spz_url = ready.spz_url;
    entry.pano_url = ready.pano_url;
  }
  saveOverrides(overrides);

  console.log("Ready:", {
    spz: ready.spz_url ? "yes" : "no",
    pano: ready.pano_url ? "yes" : "no",
  });
}

async function main() {
  const keys =
    target === "all"
      ? PREBUILT_WORLDS.map((w) => w.key)
      : [target];

  for (const key of keys) {
    await buildOne(key);
  }
  console.log("\nUpdated data/prebuilt-worlds.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
