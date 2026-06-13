/**
 * Copy a memory_place record from local Redis to the Render production app.
 *
 * Usage:
 *   npx tsx scripts/upload-memory-to-render.ts [place_id]
 *
 * Env:
 *   RENDER_APP_URL — production app URL (default: https://duobingo-genui-hack.onrender.com)
 *   REDIS_URL      — source Redis (default: redis://localhost:6379)
 */

import Redis from "ioredis";

const uid = "demo";
const placeId =
  process.argv[2] ?? "ChIJ08XLvMoEdkgR8jMUChbcmgE";
const renderAppUrl =
  process.env.RENDER_APP_URL ?? "https://duobingo-genui-hack.onrender.com";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

async function main() {
  const redis = new Redis(redisUrl);
  const key = `memory_place:${uid}:${placeId}`;
  const raw = await redis.get(key);
  await redis.quit();

  if (!raw) {
    console.error(`No record found at ${key}`);
    process.exit(1);
  }

  const record = JSON.parse(raw);
  console.log("Local record:", {
    place_name: record.place_name,
    pano_status: record.pano_status,
    world_status: record.world_status,
    spz_url: record.spz_url ? "yes" : "no",
    world_id: record.world_id,
  });

  const importUrl = `${renderAppUrl.replace(/\/$/, "")}/api/memory-place/import`;
  const res = await fetch(importUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, record }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Import failed:", res.status, body);
    process.exit(1);
  }

  console.log("Imported to Render:", body);

  const statusUrl = `${renderAppUrl.replace(/\/$/, "")}/api/memory-place/status?uid=${uid}&place_id=${encodeURIComponent(placeId)}`;
  const statusRes = await fetch(statusUrl);
  const status = await statusRes.json();
  console.log("Production status:", status);
  console.log(
    `Open: ${renderAppUrl.replace(/\/$/, "")}/memory/${encodeURIComponent(placeId)}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
