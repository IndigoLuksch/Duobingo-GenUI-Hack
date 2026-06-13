export interface AuthenticSentence {
  sentence: string;
  source: string;
}

/**
 * Search the web for a short, authentic French sentence containing the given word.
 * Returns null if no suitable sentence is found (do not block the UX on failure).
 */
export async function fetchAuthenticSentence(
  frenchWord: string,
  englishTranslation: string
): Promise<AuthenticSentence | null> {
  if (!process.env.LINKUP_API_KEY) {
    return null;
  }

  try {
    const { LinkupClient } = await import("linkup-sdk");
    const client = new LinkupClient({ apiKey: process.env.LINKUP_API_KEY });

    const response = await client.search({
      query: `Example sentence in French using the word "${frenchWord}" (meaning: ${englishTranslation})`,
      depth: "standard",
      outputType: "structured",
      structuredOutputSchema: JSON.stringify({
        type: "object",
        properties: {
          sentence: {
            type: "string",
            description:
              "A single short French sentence (max 15 words) that naturally uses the target word. Must be grammatically correct and from real usage.",
          },
          source: {
            type: "string",
            description:
              "The source website or publication name where this usage was found.",
          },
        },
        required: ["sentence", "source"],
      }),
    });

    const parsed = response as { sentence?: string; source?: string };
    if (parsed.sentence && parsed.source) {
      return { sentence: parsed.sentence, source: parsed.source };
    }
    return null;
  } catch (e) {
    console.warn("LinkUp sentence fetch failed:", e);
    return null;
  }
}
