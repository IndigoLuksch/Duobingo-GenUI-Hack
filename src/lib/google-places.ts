const PLACES_BASE = "https://places.googleapis.com/v1";

function placesKey(): string {
  return process.env.GOOGLE_PLACES_API_KEY || "";
}

export interface PlacePhoto {
  name: string;
  url: string;
  widthPx?: number;
  heightPx?: number;
}

export interface PlaceDetails {
  place_id: string;
  place_name: string;
  address: string | null;
  photos: PlacePhoto[];
}

export interface PlaceSuggestion {
  place_id: string;
  place_name: string;
  description: string;
}

export async function autocompletePlaces(
  input: string,
  includedPrimaryTypes?: string[]
): Promise<PlaceSuggestion[]> {
  const apiKey = placesKey();
  const trimmed = input.trim();
  if (!apiKey || trimmed.length < 2) return [];

  const body: Record<string, unknown> = { input: trimmed };
  if (includedPrimaryTypes?.length) {
    body.includedPrimaryTypes = includedPrimaryTypes;
  }

  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.warn("Places autocomplete failed:", res.status, detail);
    throw new Error(parsePlacesError(detail));
  }

  const data = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }[];
  };

  return (data.suggestions ?? [])
    .map((item) => item.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .map((prediction) => {
      const main =
        prediction.structuredFormat?.mainText?.text ??
        prediction.text?.text ??
        "Unknown place";
      const secondary = prediction.structuredFormat?.secondaryText?.text;
      return {
        place_id: prediction.placeId!,
        place_name: main,
        description: secondary ? `${main}, ${secondary}` : main,
      };
    });
}

function parsePlacesError(body: string): string {
  try {
    const data = JSON.parse(body) as {
      error?: { message?: string };
    };
    return data.error?.message?.trim() || "Places search failed";
  } catch {
    return "Places search failed";
  }
}

export async function fetchPlaceDetails(
  placeId: string,
  placeName?: string
): Promise<PlaceDetails | null> {
  const apiKey = placesKey();
  if (!apiKey) return null;

  const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,photos",
    },
  });

  if (!res.ok) {
    console.warn("Places details failed:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    photos?: { name?: string; widthPx?: number; heightPx?: number }[];
  };

  const photos: PlacePhoto[] = [];
  for (const photo of (data.photos ?? []).slice(0, 10)) {
    if (!photo.name) continue;
    const url = await fetchPhotoUrl(photo.name, apiKey);
    if (url) {
      photos.push({
        name: photo.name,
        url,
        widthPx: photo.widthPx,
        heightPx: photo.heightPx,
      });
    }
  }

  return {
    place_id: placeId,
    place_name: data.displayName?.text ?? placeName ?? placeId,
    address: data.formattedAddress ?? null,
    photos,
  };
}

async function fetchPhotoUrl(
  photoName: string,
  apiKey: string
): Promise<string | null> {
  const res = await fetch(
    `${PLACES_BASE}/${photoName}/media?maxWidthPx=1024&skipHttpRedirect=true`,
    { headers: { "X-Goog-Api-Key": apiKey } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { photoUri?: string };
  return data.photoUri ?? null;
}

export async function downloadPhotoAsBase64(url: string): Promise<{
  base64: string;
  mimeType: string;
} | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    return { base64: buffer.toString("base64"), mimeType };
  } catch (e) {
    console.warn("Photo download failed:", e);
    return null;
  }
}
