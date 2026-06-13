import { getMemoryPlace, setMemoryPlace } from "./redis";
import { MemoryPlaceRecord } from "./types";
import {
  extractWorldAssets,
  getOperation,
  getWorld,
  MarbleWorld,
  prepareAndUploadImage,
  startWorldGeneration,
} from "./worldlabs";

const POLL_MS = 10_000;
const MAX_POLLS = 60;

function mergeMarbleWorld(
  record: MemoryPlaceRecord,
  world: MarbleWorld,
  photoUrl: string
): MemoryPlaceRecord {
  const { pano_url, spz_url } = extractWorldAssets(world);
  return {
    ...record,
    world_id: world.world_id ?? record.world_id ?? null,
    pano_url: pano_url ?? record.pano_url ?? photoUrl,
    pano_status: "ready",
    spz_url: spz_url ?? record.spz_url,
    world_status: spz_url ? "ready" : "generating",
  };
}

async function resolveMarbleAssets(
  record: MemoryPlaceRecord,
  photoUrl: string
): Promise<MemoryPlaceRecord | null> {
  let worldId = record.world_id ?? null;

  if (record.world_operation_id) {
    const op = await getOperation(record.world_operation_id);
    if (op) {
      worldId = op.metadata?.world_id ?? worldId;

      if (op.done && op.error) {
        return {
          ...record,
          world_id: worldId,
          pano_url: record.pano_url ?? photoUrl,
          pano_status: "ready",
          world_status: "not_started",
        };
      }

      if (op.done && op.response) {
        return mergeMarbleWorld(record, op.response, photoUrl);
      }
    }
  }

  if (worldId) {
    const world = await getWorld(worldId);
    if (world) {
      const { pano_url, spz_url } = extractWorldAssets(world);
      if (pano_url || spz_url) {
        return mergeMarbleWorld(record, world, photoUrl);
      }
    }
  }

  if (worldId && worldId !== record.world_id) {
    return { ...record, world_id: worldId };
  }

  return null;
}

export async function runMemoryGeneration(
  uid: string,
  placeId: string,
  photoUrl: string,
  placeName: string,
  textPrompt?: string
): Promise<void> {
  const existing = await getMemoryPlace(uid, placeId);
  if (!existing) return;

  if (!process.env.WORLDLABS_API_KEY) {
    await setMemoryPlace(uid, {
      ...existing,
      pano_url: photoUrl,
      pano_status: "ready",
      world_status: "not_started",
      world_operation_id: null,
      world_id: null,
    });
    return;
  }

  const mediaAssetId = await prepareAndUploadImage(photoUrl);
  if (!mediaAssetId) {
    await setMemoryPlace(uid, {
      ...existing,
      pano_url: photoUrl,
      pano_status: "ready",
      world_status: "not_started",
    });
    return;
  }

  const operationId = await startWorldGeneration(
    mediaAssetId,
    placeName,
    textPrompt
  );
  if (!operationId) {
    await setMemoryPlace(uid, {
      ...existing,
      pano_url: photoUrl,
      pano_status: "ready",
      world_status: "not_started",
    });
    return;
  }

  await setMemoryPlace(uid, {
    ...existing,
    world_operation_id: operationId,
    world_status: "generating",
    pano_status: "generating",
  });

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    const record = await getMemoryPlace(uid, placeId);
    if (!record) return;

    const updated = await resolveMarbleAssets(record, photoUrl);
    if (!updated) continue;

    await setMemoryPlace(uid, updated);
    if (updated.world_status === "ready" && updated.spz_url) return;
    if (updated.world_status === "not_started") return;
  }

  const record = await getMemoryPlace(uid, placeId);
  if (!record) return;

  const synced = await resolveMarbleAssets(record, photoUrl);
  if (synced) {
    await setMemoryPlace(uid, synced);
    return;
  }

  await setMemoryPlace(uid, {
    ...record,
    pano_url: record.pano_url ?? photoUrl,
    pano_status: "ready",
  });
}

export async function refreshMemoryPlaceFromMarble(
  uid: string,
  placeId: string
): Promise<void> {
  const record = await getMemoryPlace(uid, placeId);
  if (!record) return;
  if (record.world_status === "ready" && record.spz_url) return;

  const updated = await resolveMarbleAssets(record, record.source_photo_url);
  if (updated) {
    await setMemoryPlace(uid, updated);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
