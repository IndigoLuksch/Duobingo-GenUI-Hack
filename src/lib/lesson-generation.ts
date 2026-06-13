import { CourseId, LANGUAGE_LABELS } from "./courses";
import { Unit, VocabItem, SentenceItem } from "./types";

interface RawVocab {
  target?: string;
  de?: string;
  fr?: string;
  en?: string;
  gender?: "m" | "f" | null;
  distractors?: string[];
}

interface RawSentence {
  target?: string;
  de?: string;
  fr?: string;
  en?: string;
  tiles?: string[];
  answer?: string[];
}

interface RawLesson {
  title?: string;
  description?: string;
  icon?: string;
  marble_prompt?: string;
  vocab?: RawVocab[];
  sentences?: RawSentence[];
}

function buildLessonSchema(languageName: string): string {
  return JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string", description: "Lesson title, e.g. 'At the Park'" },
      description: {
        type: "string",
        description: "Short subtitle, max 8 words",
      },
      icon: { type: "string", description: "Single emoji representing the topic" },
      marble_prompt: {
        type: "string",
        description:
          "Detailed photorealistic scene description for a 3D world of this setting",
      },
      vocab: {
        type: "array",
        items: {
          type: "object",
          properties: {
            target: {
              type: "string",
              description: `${languageName} word with article`,
            },
            en: { type: "string", description: "English translation" },
            gender: {
              type: "string",
              enum: ["m", "f"],
              description: "Grammatical gender, or omit for neuter",
            },
            distractors: {
              type: "array",
              items: { type: "string" },
              description: `Exactly 3 plausible wrong ${languageName} options with articles`,
            },
          },
          required: ["target", "en", "distractors"],
        },
        minItems: 8,
        maxItems: 10,
      },
      sentences: {
        type: "array",
        items: {
          type: "object",
          properties: {
            target: { type: "string", description: `${languageName} sentence` },
            en: { type: "string", description: "English translation" },
            answer: {
              type: "array",
              items: { type: "string" },
              description: "Correct word order as token array",
            },
            tiles: {
              type: "array",
              items: { type: "string" },
              description:
                "Shuffled tiles including answer tokens plus 2-3 distractor words",
            },
          },
          required: ["target", "en", "answer", "tiles"],
        },
        minItems: 4,
        maxItems: 4,
      },
    },
    required: [
      "title",
      "description",
      "icon",
      "marble_prompt",
      "vocab",
      "sentences",
    ],
  });
}

const TILE_EXTRAS: Record<CourseId, string[]> = {
  de: ["Und", "Ist", "Die", "Der", "Das", "Ein"],
  fr: ["Et", "Est", "La", "Le", "Un", "Une"],
  it: ["E", "È", "La", "Il", "Un", "Una"],
};

function targetText(entry: RawVocab | RawSentence): string {
  return (entry.target ?? entry.de ?? entry.fr ?? "").trim();
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(der|die|das|le|la|l'|il|lo|la|i|gli|le|un|une|ein|eine)\s+/i, "")
    .replace(/[^a-z0-9äöüßàèéìòù]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 36);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTitle(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed) return "Custom Lesson";
  if (/^(in|at|on)\s+(the|an?)\s+/i.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  const lower = trimmed.toLowerCase();
  const vowel = /^[aeiou]/.test(lower);
  const article = vowel ? "At an" : "At the";
  return `${article} ${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function normalizeVocab(raw: RawVocab[]): VocabItem[] {
  const seen = new Set<string>();
  const items: VocabItem[] = [];

  for (const entry of raw) {
    const target = targetText(entry);
    const en = (entry.en ?? "").trim();
    if (!target || !en) continue;

    let wordId = slugify(target);
    if (!wordId || seen.has(wordId)) {
      wordId = `${wordId || "word"}_${items.length + 1}`;
    }
    seen.add(wordId);

    const distractors = (entry.distractors ?? [])
      .map((d) => d.trim())
      .filter((d) => d && d !== target)
      .slice(0, 3);

    while (distractors.length < 3) {
      distractors.push(`option_${distractors.length + 1}`);
    }

    items.push({
      word_id: wordId,
      fr: target,
      en,
      gender: entry.gender ?? null,
      distractors,
    });

    if (items.length >= 10) break;
  }

  return items;
}

function normalizeSentences(
  raw: RawSentence[],
  courseId: CourseId
): SentenceItem[] {
  const extras = TILE_EXTRAS[courseId];
  const items: SentenceItem[] = [];

  for (const entry of raw) {
    const fr = targetText(entry);
    const en = (entry.en ?? "").trim();
    const answer = (entry.answer ?? []).map((t) => t.trim()).filter(Boolean);
    if (!fr || !en || answer.length < 2) continue;

    let tiles = (entry.tiles ?? []).map((t) => t.trim()).filter(Boolean);
    if (tiles.length < answer.length + 2) {
      tiles = shuffle([...answer, ...extras]);
    } else {
      tiles = shuffle(tiles);
    }

    items.push({ fr, en, tiles, answer });
    if (items.length >= 4) break;
  }

  return items;
}

function buildUnit(
  topic: string,
  raw: RawLesson,
  courseId: CourseId
): Unit | null {
  const vocab = normalizeVocab(raw.vocab ?? []);
  const sentences = normalizeSentences(raw.sentences ?? [], courseId);

  if (vocab.length < 6 || sentences.length < 3) {
    return null;
  }

  const slug = slugify(topic) || "lesson";
  const suffix = Math.random().toString(36).slice(2, 8);
  const unitId = `custom_${slug}_${suffix}`;
  const title = raw.title?.trim() || formatTitle(topic);

  return {
    unit_id: unitId,
    title,
    description: raw.description?.trim() || `Learn ${topic.trim()} vocabulary`,
    icon: raw.icon?.trim() || "✨",
    world_id: unitId,
    splat_world_id: "cafe_fr",
    marble_prompt:
      raw.marble_prompt?.trim() ||
      `A photorealistic scene related to ${title}, warmly lit, with recognizable objects for language practice.`,
    vocab,
    sentences,
    custom: true,
  };
}

async function fetchLessonWithLinkup(
  topic: string,
  languageName: string,
  courseId: CourseId
): Promise<RawLesson | null> {
  if (!process.env.LINKUP_API_KEY) return null;

  try {
    const { LinkupClient } = await import("linkup-sdk");
    const client = new LinkupClient({ apiKey: process.env.LINKUP_API_KEY });

    const response = await client.search({
      query: `Create a beginner ${languageName} language lesson about "${topic}". Find real vocabulary and natural example sentences from authentic ${languageName} sources online (news, blogs, textbooks). Include common nouns with articles and gender, plus short everyday sentences learners can practice.`,
      depth: "deep",
      outputType: "structured",
      structuredOutputSchema: buildLessonSchema(languageName),
    });

    return response as RawLesson;
  } catch (e) {
    console.warn("LinkUp lesson generation failed:", e);
    return null;
  }
}

async function fetchLessonWithGemini(
  topic: string,
  languageName: string
): Promise<RawLesson | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are building a beginner ${languageName} language lesson about "${topic}".

Return ONLY valid JSON matching this shape:
{
  "title": "At the Park",
  "description": "Trees, benches & playground",
  "icon": "🌳",
  "marble_prompt": "detailed photorealistic 3D scene description",
  "vocab": [
    { "target": "example word with article", "en": "english", "gender": "m", "distractors": ["wrong1", "wrong2", "wrong3"] }
  ],
  "sentences": [
    { "target": "short sentence in ${languageName}", "en": "English translation", "answer": ["token", "order"], "tiles": ["shuffled", "tokens", "with", "extras"] }
  ]
}

Rules:
- 8-10 vocab items, exactly 4 sentences
- Use "target" field for ${languageName} words with articles
- gender is "m", "f", or omit for neuter
- distractors must be plausible wrong options with articles
- tiles must include answer tokens plus 2-3 extra distractor words, shuffled
- marble_prompt should describe a navigable interior or outdoor scene`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn("Gemini lesson generation failed:", await res.text());
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return JSON.parse(text) as RawLesson;
  } catch (e) {
    console.warn("Gemini lesson generation error:", e);
    return null;
  }
}

export async function generateLesson(
  topic: string,
  courseId: CourseId
): Promise<Unit | null> {
  const trimmed = topic.trim();
  if (!trimmed) return null;

  const languageName = LANGUAGE_LABELS[courseId].name;

  const linkupResult = await fetchLessonWithLinkup(
    trimmed,
    languageName,
    courseId
  );
  if (linkupResult) {
    const unit = buildUnit(trimmed, linkupResult, courseId);
    if (unit) return unit;
  }

  const geminiResult = await fetchLessonWithGemini(trimmed, languageName);
  if (geminiResult) {
    const unit = buildUnit(trimmed, geminiResult, courseId);
    if (unit) return unit;
  }

  return null;
}

export { formatTitle };
