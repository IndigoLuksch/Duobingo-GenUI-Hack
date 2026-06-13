import { getMemoryPlace, setMemoryPlace } from "./redis";
import {
  extractWorldAssets,
  getOperation,
  prepareAndUploadImage,
  startWorldGeneration,
} from "./worldlabs";

const POLL_MS = 10_000;
const MAX_POLLS = 60;

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

    const op = await getOperation(operationId);
    if (!op) continue;

    if (op.done && op.error) {
      await setMemoryPlace(uid, {
        ...record,
        pano_url: photoUrl,
        pano_status: "ready",
        world_status: "not_started",
      });
      return;
    }

    if (op.done && op.response) {
      const { pano_url, spz_url } = extractWorldAssets(op.response);
      await setMemoryPlace(uid, {
        ...record,
        pano_url: pano_url ?? photoUrl,
        pano_status: "ready",
        spz_url,
        world_status: spz_url ? "ready" : "generating",
      });
      return;
    }
  }

  const record = await getMemoryPlace(uid, placeId);
  if (record) {
    await setMemoryPlace(uid, {
      ...record,
      pano_url: photoUrl,
      pano_status: "ready",
    });
  }
}

export async function refreshMemoryPlaceFromMarble(
  uid: string,
  placeId: string
): Promise<void> {
  const record = await getMemoryPlace(uid, placeId);
  if (!record?.world_operation_id || record.world_status === "ready") return;

  const op = await getOperation(record.world_operation_id);
  if (!op?.done || !op.response) return;

  const { pano_url, spz_url } = extractWorldAssets(op.response);
  await setMemoryPlace(uid, {
    ...record,
    pano_url: pano_url ?? record.pano_url ?? record.source_photo_url,
    pano_status: "ready",
    spz_url: spz_url ?? record.spz_url,
    world_status: spz_url ? "ready" : record.world_status,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
