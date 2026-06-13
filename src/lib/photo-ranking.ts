import { RankedPhoto } from "./types";
import { PlacePhoto } from "./google-places";

const PHOTO_SELECTION_PROMPT = (placeName: string) => `You are helping a language learner choose the best photo of "${placeName}" to rebuild as a 3D practice environment.

You will receive up to 10 photos labeled Photo 0 through Photo N.

Rank the TOP 3 photos that would work best as the starting point for a navigable interior scene. Prefer:
- Clear, well-lit interior views
- Recognizable objects (furniture, fixtures, signage)
- Minimal motion blur or obstruction
- A sense of depth and spatial layout

Return ONLY valid JSON in this exact shape:
{
  "ranked_photos": [
    { "photo_index": 0, "score": 0.95, "label": "Wide dining area" }
  ]
}

Include exactly 3 items, sorted best-first. photo_index must match the photo number shown.`;

export async function rankPhotosWithGemini(
  placeName: string,
  photos: PlacePhoto[],
  photoData: { base64: string; mimeType: string }[]
): Promise<RankedPhoto[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || photoData.length === 0) {
    return fallbackRanking(photos);
  }

  const parts: unknown[] = [
    { text: PHOTO_SELECTION_PROMPT(placeName) },
    { text: `Analyzing ${photoData.length} photos of ${placeName}.` },
  ];

  photoData.forEach((img, index) => {
    parts.push({ text: `Photo ${index}:` });
    parts.push({
      inlineData: { mimeType: img.mimeType, data: img.base64 },
    });
  });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn("Gemini photo ranking failed:", await res.text());
      return fallbackRanking(photos);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallbackRanking(photos);

    const parsed = JSON.parse(text) as {
      ranked_photos?: {
        photo_index: number;
        score: number;
        label: string;
      }[];
    };

    const ranked = (parsed.ranked_photos ?? [])
      .slice(0, 3)
      .map((item) => {
        const photo = photos[item.photo_index];
        if (!photo) return null;
        return {
          photo_index: item.photo_index,
          score: item.score,
          label: item.label,
          url: photo.url,
          photo_name: photo.name,
        } as RankedPhoto;
      })
      .filter((r) => r !== null) as RankedPhoto[];

    return ranked.length > 0 ? ranked : fallbackRanking(photos);
  } catch (e) {
    console.warn("Gemini photo ranking error:", e);
    return fallbackRanking(photos);
  }
}

function fallbackRanking(photos: PlacePhoto[]): RankedPhoto[] {
  return photos.slice(0, 3).map((photo, index) => ({
    photo_index: index,
    score: 1 - index * 0.1,
    label: index === 0 ? "Best available view" : `Alternate view ${index + 1}`,
    url: photo.url,
    photo_name: photo.name,
  }));
}
