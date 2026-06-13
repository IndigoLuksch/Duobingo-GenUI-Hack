const STREETVIEW_BASE = "https://maps.googleapis.com/maps/api/streetview";

function mapsKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ""
  );
}

export interface StreetViewLocation {
  lat: number;
  lng: number;
  pano_id?: string;
}

export interface StreetViewAvailability {
  available: boolean;
  lat?: number;
  lng?: number;
  pano_id?: string;
  status?: string;
}

export async function checkStreetViewAvailability(
  lat: number,
  lng: number
): Promise<StreetViewAvailability> {
  const apiKey = mapsKey();
  if (!apiKey) {
    return { available: false, status: "NO_API_KEY" };
  }

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    key: apiKey,
  });

  const res = await fetch(`${STREETVIEW_BASE}/metadata?${params.toString()}`);
  if (!res.ok) {
    return { available: false, status: "REQUEST_FAILED" };
  }

  const data = (await res.json()) as {
    status?: string;
    location?: { lat?: number; lng?: number };
    pano_id?: string;
  };

  if (data.status !== "OK") {
    return { available: false, status: data.status ?? "ZERO_RESULTS" };
  }

  return {
    available: true,
    lat: data.location?.lat ?? lat,
    lng: data.location?.lng ?? lng,
    pano_id: data.pano_id,
    status: data.status,
  };
}

/** Wide 2:1 image suitable for equirectangular sphere mapping in PanoViewer. */
export function buildStreetViewImageUrl(
  lat: number,
  lng: number,
  panoId?: string
): string {
  const apiKey = mapsKey();
  const params = new URLSearchParams({
    size: "2048x1024",
    fov: "90",
    pitch: "0",
    key: apiKey,
  });

  if (panoId) {
    params.set("pano", panoId);
  } else {
    params.set("location", `${lat},${lng}`);
  }

  return `${STREETVIEW_BASE}?${params.toString()}`;
}

export async function resolveStreetViewForPlace(
  lat: number,
  lng: number
): Promise<{ imageUrl: string; location: StreetViewLocation } | null> {
  const availability = await checkStreetViewAvailability(lat, lng);
  if (!availability.available) return null;

  const resolvedLat = availability.lat ?? lat;
  const resolvedLng = availability.lng ?? lng;
  const imageUrl = buildStreetViewImageUrl(
    resolvedLat,
    resolvedLng,
    availability.pano_id
  );

  return {
    imageUrl,
    location: {
      lat: resolvedLat,
      lng: resolvedLng,
      pano_id: availability.pano_id,
    },
  };
}
