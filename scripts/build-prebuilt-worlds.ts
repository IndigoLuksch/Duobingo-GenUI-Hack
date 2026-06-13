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
import {
  PREBUILT_WORLDS,
  PrebuiltWorldKey,
  toMemoryPlaceRecord,
} from "../src/lib/prebuilt-worlds";
import { fetchPlaceDetails, searchPlaceByText } from "../src/lib/google-places";
import { runMemoryGeneration } from "../src/lib/memory-generation";
import { getMemoryPlace, setMemoryPlace } from "../src/lib/redis";
import redis from "../src/lib/redis";

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
    if (
      record?.world_status === "not_started" &&
      record.pano_status === "ready" &&
      !record.world_operation_id
    ) {
      throw new Error(
        "Marble generation never started (check WORLDLABS_API_KEY and logs above)"
      );
    }
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(
      `  … polling (${elapsed}s) world_status=${record?.world_status ?? "missing"} op=${record?.world_operation_id ?? "none"}`
    );
    await new Promise((r) => setTimeout(r, 15_000));
  }
  throw new Error(`Timed out waiting for world ${placeId}`);
}

async function buildOne(key: PrebuiltWorldKey) {
  const world = PREBUILT_WORLDS.find((w) => w.key === key);
  if (!world) throw new Error(`Unknown key: ${key}`);

  console.log(`\n=== ${world.place_name} (${key}) ===`);
  console.log(`place_id: ${world.place_id}`);

  if (!process.env.WORLDLABS_API_KEY) {
    throw new Error("WORLDLABS_API_KEY is not set in .env.local");
  }

  console.log("Fetching first place photo from Google Places…");
  let details = await fetchPlaceDetails(world.place_id, world.place_name, 1);
  if (!details?.photos[0]?.url) {
    const query =
      key === "pret"
        ? "Pret A Manger Kings Cross Station London"
        : key === "station"
          ? "London King's Cross Station"
          : "GAIL's Bakery Kings Cross London";
    console.log(`Place lookup failed for cached id — searching: ${query}`);
    const matches = await searchPlaceByText(query, 1);
    if (!matches[0]) {
      throw new Error(`No Google place found for ${world.place_name}`);
    }
    console.log(`Resolved ${matches[0].place_name} (${matches[0].place_id})`);
    details = await fetchPlaceDetails(matches[0].place_id, matches[0].place_name, 1);
  }
  if (!details?.photos[0]?.url) {
    throw new Error(`No photo for ${world.place_name}`);
  }
  console.log(`Resolved place: ${details.place_name}`);
  console.log(`Address: ${details.address ?? "unknown"}`);

  const record = toMemoryPlaceRecord(world);
  record.place_id = details.place_id;
  record.place_name = details.place_name;
  record.source_photo_url = details.photos[0].url;
  record.address = details.address;
  await setMemoryPlace(uid, record);
  const seeded = await getMemoryPlace(uid, details.place_id);
  if (!seeded) {
    throw new Error(
      "Could not read memory place from Redis — is docker compose up / REDIS_URL correct?"
    );
  }
  console.log("Seeded Redis record");

  console.log("Starting Marble world generation…");
  await runMemoryGeneration(
    uid,
    details.place_id,
    details.photos[0].url,
    details.place_name,
    `A realistic navigable interior of ${details.place_name} at King's Cross, London, suitable for language learning.`
  );

  const afterStart = await getMemoryPlace(uid, details.place_id);
  if (!afterStart?.world_operation_id) {
    console.error("Redis record after generation attempt:", afterStart);
    throw new Error("No operation_id saved — Marble API call did not start");
  }
  console.log(`Marble operation_id: ${afterStart.world_operation_id}`);

  console.log("Waiting for splat (up to ~12 min)…");
  const ready = await waitForReady(details.place_id);
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
  try {
    await redis.connect();
  } catch {
    throw new Error(
      "Could not connect to Redis — run: docker compose up -d"
    );
  }

  const keys =
    target === "all"
      ? PREBUILT_WORLDS.map((w) => w.key)
      : [target];

  for (const key of keys) {
    await buildOne(key);
  }
  console.log("\nUpdated data/prebuilt-worlds.json");
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
