const BASE_URL = "https://api.worldlabs.ai/marble/v1";

function apiKey(): string {
  return process.env.WORLDLABS_API_KEY || "";
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "WLT-Api-Key": apiKey(),
  };
}

export interface MarbleOperation {
  operation_id: string;
  done: boolean;
  error?: { message?: string } | null;
  metadata?: { world_id?: string } | null;
  response?: MarbleWorld | null;
}

export interface MarbleWorld {
  world_id?: string;
  id?: string;
  assets?: {
    imagery?: { pano_url?: string | null };
    splats?: { spz_urls?: Record<string, string> | null };
  };
}

export async function prepareAndUploadImage(
  imageUrl: string
): Promise<string | null> {
  const key = apiKey();
  if (!key) return null;

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) return null;
  const buffer = Buffer.from(await imageRes.arrayBuffer());
  const contentType = imageRes.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";

  const prepRes = await fetch(`${BASE_URL}/media-assets:prepare_upload`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      file_name: `memory.${ext}`,
      kind: "image",
      extension: ext,
    }),
  });
  if (!prepRes.ok) {
    console.warn("World Labs prepare_upload failed:", await prepRes.text());
    return null;
  }

  const prep = (await prepRes.json()) as {
    media_asset?: { media_asset_id?: string };
    upload_info?: {
      upload_url?: string;
      required_headers?: Record<string, string> | null;
    };
  };
  const mediaAssetId = prep.media_asset?.media_asset_id;
  const uploadUrl = prep.upload_info?.upload_url;
  if (!mediaAssetId || !uploadUrl) return null;

  const uploadHeaders: Record<string, string> = {
    ...(prep.upload_info?.required_headers ?? {}),
  };
  if (!uploadHeaders["Content-Type"]) {
    uploadHeaders["Content-Type"] = contentType;
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: uploadHeaders,
    body: new Uint8Array(buffer),
  });
  if (!uploadRes.ok) {
    console.warn(
      "World Labs upload failed:",
      uploadRes.status,
      await uploadRes.text()
    );
    return null;
  }

  return mediaAssetId;
}

export async function startWorldGeneration(
  mediaAssetId: string,
  displayName: string,
  textPrompt?: string
): Promise<string | null> {
  const key = apiKey();
  if (!key) return null;

  const worldPrompt: Record<string, unknown> = {
    type: "image",
    image_prompt: {
      source: "media_asset",
      media_asset_id: mediaAssetId,
      is_pano: false,
    },
  };
  if (textPrompt) {
    worldPrompt.text_prompt = textPrompt;
  }

  const res = await fetch(`${BASE_URL}/worlds:generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      display_name: displayName,
      model: "marble-1.1",
      world_prompt: worldPrompt,
    }),
  });

  if (!res.ok) {
    console.warn("World Labs generate failed:", await res.text());
    return null;
  }

  const data = (await res.json()) as { operation_id?: string };
  return data.operation_id ?? null;
}

export async function getOperation(
  operationId: string
): Promise<MarbleOperation | null> {
  const key = apiKey();
  if (!key) return null;

  const res = await fetch(`${BASE_URL}/operations/${operationId}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  return (await res.json()) as MarbleOperation;
}

export function extractWorldAssets(world: MarbleWorld | null | undefined): {
  pano_url: string | null;
  spz_url: string | null;
} {
  if (!world?.assets) {
    return { pano_url: null, spz_url: null };
  }
  const pano_url = world.assets.imagery?.pano_url ?? null;
  const spzUrls = world.assets.splats?.spz_urls ?? {};
  const spz_url =
    spzUrls.full ??
    spzUrls["500k"] ??
    spzUrls["100k"] ??
    Object.values(spzUrls)[0] ??
    null;
  return { pano_url, spz_url };
}
