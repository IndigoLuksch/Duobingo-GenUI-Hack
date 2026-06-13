# LOCI LINGUA — Staged Implementation Plan

> **For Cursor Composer 2.5.** Read the current stage fully before writing any code. Complete each stage in order — do not skip ahead. Each stage ends with a verification checklist. Do not proceed to the next stage until all verification checks pass. Do not deviate from the tech stack, file structure, or data shapes specified.

---

## Overview

A language-learning app. User flow:
1. Path map → 2. AI-generated lesson (8 exercises via CopilotKit AG-UI) → 3. Portal transition → 4. 3D world (Gaussian splat) + Gemini Live voice tutor that *sees* the scene → 5. Progress saved to Redis.

Key tech: Next.js 15, CopilotKit/AG-UI, Google ADK, Gemini Live API (WebSocket), Spark.js (Gaussian splatting), Redis, Zustand, Framer Motion, LinkUp AI (authentic example sentences).

---

## STAGE 1: Project Scaffold & Infrastructure

### 1.1 Objective
Create the monorepo file structure, install all dependencies at pinned versions, and start Redis.

### 1.2 Create the directory structure

Create ALL of these directories and empty placeholder files:

```
loci-lingua/
├── package.json
├── .env.local
├── docker-compose.yml
├── data/
│   └── courses/
│       └── fr.json
├── public/
│   └── worlds/
│       ├── kitchen_fr.spz          (empty placeholder)
│       └── cafe_fr.spz             (empty placeholder)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── lesson/
│   │   │   └── [unitId]/
│   │   │       └── page.tsx
│   │   ├── world/
│   │   │   └── [worldId]/
│   │   │       └── page.tsx
│   │   └── api/
│   │       ├── copilotkit/
│   │       │   └── route.ts
│   │       ├── gemini-token/
│   │       │   └── route.ts
│   │       ├── linkup/
│   │       │   └── example-sentence/
│   │       │       └── route.ts
│   │       └── redis/
│   │           ├── update-strength/
│   │           │   └── route.ts
│   │           ├── save-word/
│   │           │   └── route.ts
│   │           └── profile/
│   │               └── route.ts
│   ├── components/
│   │   ├── PathMap.tsx
│   │   ├── LessonHUD.tsx
│   │   ├── exercises/
│   │   │   ├── MultipleChoice.tsx
│   │   │   ├── WordBank.tsx
│   │   │   ├── Listening.tsx
│   │   │   └── SpeakIt.tsx
│   │   ├── PortalTransition.tsx
│   │   ├── SplatScene.tsx
│   │   ├── GeminiLiveController.tsx
│   │   ├── WorldCard.tsx
│   │   └── WorldHUD.tsx
│   ├── lib/
│   │   ├── gemini-live.ts
│   │   ├── frame-capture.ts
│   │   ├── linkup.ts
│   │   ├── srs.ts
│   │   ├── redis.ts
│   │   ├── store.ts
│   │   └── types.ts
│   └── styles/
│       └── globals.css
└── services/
    └── agents/
        ├── lesson_director.py
        ├── server.py
        └── requirements.txt
```

### 1.3 package.json

Use these EXACT dependency versions. Do not upgrade `three` or `@sparkjsdev/spark` — Spark's Three.js compatibility is version-sensitive.

```json
{
  "name": "loci-lingua",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "seed": "npx tsx src/lib/seed.ts"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "three": "0.180.0",
    "@sparkjsdev/spark": "2.1.0",
    "@copilotkit/react-core": "latest",
    "@copilotkit/react-ui": "latest",
    "zustand": "^4.5.0",
    "framer-motion": "^11.0.0",
    "ioredis": "^5.4.0",
    "uuid": "^9.0.0",
    "linkup-sdk": "latest"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/three": "^0.180.0",
    "@types/uuid": "^9.0.0",
    "tsx": "^4.0.0"
  }
}
```

### 1.4 docker-compose.yml

```yaml
services:
  redis:
    image: redis/redis-stack:latest
    ports:
      - "6379:6379"
      - "8001:8001"
```

### 1.5 .env.local

```
GEMINI_API_KEY=
REDIS_URL=redis://localhost:6379
GOOGLE_PLACES_API_KEY=
WORLDLABS_API_KEY=
LINKUP_API_KEY=
```

### 1.6 services/agents/requirements.txt

```
google-adk
google-genai
copilotkit
fastapi
uvicorn
redis
```

### 1.7 Verification — Stage 1

- [ ] Running `ls src/app/lesson/\[unitId\]/page.tsx` succeeds (file exists)
- [ ] Running `ls src/components/exercises/MultipleChoice.tsx` succeeds (file exists)
- [ ] Running `npm install` completes without errors
- [ ] Running `docker compose up -d` starts Redis (check with `docker compose ps` — redis should show "running")
- [ ] Running `npx next build` does NOT need to succeed yet (files are placeholders), but the directory structure should be complete
- [ ] `package.json` lists `"three": "0.180.0"` and `"@sparkjsdev/spark": "2.1.0"` — not upgraded

---

## STAGE 2: TypeScript Types & Course Data

### 2.1 Objective
Define all TypeScript interfaces in `src/lib/types.ts` and populate the course JSON in `data/courses/fr.json`.

### 2.2 Types — `src/lib/types.ts`

Create these EXACT interfaces. Do not rename fields, do not change types. These are the shared data contracts used across the entire app.

```typescript
// === Course content (loaded from fr.json) ===

export interface VocabItem {
  word_id: string;        // e.g. "louche"
  fr: string;             // e.g. "la louche"
  en: string;             // e.g. "ladle"
  gender: "m" | "f" | null;
  distractors: string[];  // 3 wrong options for multiple choice
}

export interface SentenceItem {
  fr: string;             // e.g. "Le four est chaud"
  en: string;             // e.g. "The oven is hot"
  tiles: string[];        // shuffled tiles including distractors
  answer: string[];       // correct order
}

export interface Unit {
  unit_id: string;
  title: string;
  icon: string;           // emoji
  world_id: string;       // matches filename: kitchen_fr → /worlds/kitchen_fr.spz
  marble_prompt: string;
  vocab: VocabItem[];
  sentences: SentenceItem[];
}

export interface Course {
  course: string;         // "fr"
  title: string;          // "French"
  units: Unit[];
}

// === Learner state (stored in Redis) ===

export interface LearnerProfile {
  uid: string;
  xp: number;
  streak: number;
  hearts: number;         // max 3, restored on world entry
  last_active: string;    // ISO date
  unit_progress: Record<string, "locked" | "current" | "complete">;
}

export interface WordStrength {
  word_id: string;
  strength: number;       // 0.0 to 1.0
  due_ts: number;         // unix timestamp
  seen: number;
  correct: number;
  wrong: number;
}

// === Exercise payloads (emitted by Lesson Director agent) ===

export interface MultipleChoiceExercise {
  type: "exercise.multiple_choice";
  exercise_id: string;
  word_id: string;
  prompt: string;
  options: string[];      // 4 options
  answer_idx: number;
  audio_url?: string;
}

export interface WordBankExercise {
  type: "exercise.word_bank";
  exercise_id: string;
  prompt_en: string;
  tiles: string[];        // shuffled including distractors
  answer: string[];       // correct tile order
}

export interface ListeningExercise {
  type: "exercise.listening";
  exercise_id: string;
  word_id: string;
  audio_url: string;
  options: string[];
  answer_idx: number;
}

export interface SpeakItExercise {
  type: "exercise.speak_it";
  exercise_id: string;
  target_text: string;
}

export interface LessonComplete {
  type: "lesson.complete";
  xp_gained: number;
  missed_word_ids: string[];
  world_id: string;
  unit_title: string;
}

export type ExercisePayload =
  | MultipleChoiceExercise
  | WordBankExercise
  | ListeningExercise
  | SpeakItExercise
  | LessonComplete;

// === World card (triggered by Gemini Live function call) ===

export interface WorldCardData {
  id: string;
  word: string;
  translation: string;
  gender: "m" | "f" | "n" | null;
  example_sentence: string | null;
  authentic_sentence: string | null;  // real sentence from LinkUp AI web search
  authentic_source: string | null;    // source attribution (e.g. "Le Monde")
  position_hint: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  timestamp: number;
}
```

### 2.3 Course data — `data/courses/fr.json`

Create the full JSON file with two units: "In the Kitchen" (`kitchen_1`) and "At the Café" (`cafe_1`). Each unit has exactly 10 vocab items and 4 sentences.

**Kitchen unit:**
- `unit_id`: `"kitchen_1"`, `title`: `"In the Kitchen"`, `icon`: `"🍳"`, `world_id`: `"kitchen_fr"`
- Vocab (10 items): table, chaise, four, refrigerateur, evier, cuisiniere, poele, marmite, etagere, fenetre
- Each vocab item has `word_id`, `fr` (with article), `en`, `gender` ("m" or "f"), and exactly 3 `distractors`
- Sentences (4): "Le four est chaud", "La marmite est sur la cuisinière", "Les chaises sont autour de la table", "Il y a une poêle sur l'étagère"
- Each sentence has `fr`, `en`, `tiles` (shuffled with 2 distractor tiles), `answer` (correct tiles in order)

**Café unit:**
- `unit_id`: `"cafe_1"`, `title`: `"At the Café"`, `icon`: `"☕"`, `world_id`: `"cafe_fr"`
- Vocab (10 items): comptoir, croissant, vitrine, chaise, table, tableau, fenetre, lampe, porte_manteau, machine_a_cafe
- Sentences (4): "Le comptoir est en marbre", "Les croissants sont dans la vitrine", "Le tableau est sur le mur", "La lampe est au-dessus de la table"

**IMPORTANT:** Use the `marble_prompt` field to document the scene prompt. This is for reference only — no code reads it at runtime. Here are the exact prompts:

Kitchen: `"A photorealistic French country kitchen interior, warmly lit. A large wooden dining table with four chairs in the center. A prominent stove with a big stockpot on the burner. A large open oven with a baking tray visible inside. A deep farmhouse sink under a window. A tall refrigerator against the wall. Open wooden shelving displaying stacked plates and bowls. A hanging pot rack above the counter with a large frying pan and a colander. A cutting board on the counter next to a bread basket. Tiled floor, wooden cabinets, copper details."`

Café: `"A photorealistic Parisian café interior. A long marble counter with a large brass espresso machine as the centerpiece. A tall glass display case filled with croissants and large pastries. Small round bistro tables with wicker chairs. A large chalkboard menu covering most of the back wall. An ornate Art Nouveau bar with shelves of bottles behind it. A coat rack near the entrance. A large arched window looking onto a Paris street with an awning. Warm amber lighting from hanging pendant lamps. Tiled mosaic floor."`

### 2.4 Verification — Stage 2

- [ ] `src/lib/types.ts` compiles with `npx tsc --noEmit src/lib/types.ts` (no errors)
- [ ] `data/courses/fr.json` is valid JSON (test with `node -e "require('./data/courses/fr.json')"`)
- [ ] The JSON has exactly 2 units
- [ ] Kitchen unit has exactly 10 vocab items, each with a `word_id`, `fr`, `en`, `gender`, and 3 `distractors`
- [ ] Kitchen unit has exactly 4 sentences, each with `fr`, `en`, `tiles`, and `answer`
- [ ] Café unit has the same structure
- [ ] The `ExercisePayload` type is a union of exactly 5 types

---

## STAGE 3: SRS Engine

### 3.1 Objective
Implement the spaced repetition system as pure functions in `src/lib/srs.ts`.

### 3.2 Implementation — `src/lib/srs.ts`

Implement these exact functions. The formulas are precise — do not change the constants.

```typescript
import { WordStrength } from "./types";

export function applyCorrect(ws: WordStrength, context: "lesson" | "world"): WordStrength {
  const boost = context === "world" ? 0.15 : 0.10;
  const newStrength = Math.min(1.0, ws.strength + boost * (1 - ws.strength));
  return {
    ...ws,
    strength: newStrength,
    due_ts: Date.now() + intervalMs(newStrength),
    seen: ws.seen + 1,
    correct: ws.correct + 1,
  };
}

export function applyWrong(ws: WordStrength, context: "lesson" | "world"): WordStrength {
  const penalty = context === "world" ? 0.10 : 0.20;
  const newStrength = Math.max(0.0, ws.strength - penalty);
  return {
    ...ws,
    strength: newStrength,
    due_ts: Date.now() + intervalMs(newStrength),
    seen: ws.seen + 1,
    wrong: ws.wrong + 1,
  };
}

function intervalMs(s: number): number {
  if (s < 0.3) return 4 * 60 * 60 * 1000;       // 4 hours
  if (s < 0.5) return 24 * 60 * 60 * 1000;      // 1 day
  if (s < 0.7) return 3 * 24 * 60 * 60 * 1000;  // 3 days
  if (s < 0.85) return 7 * 24 * 60 * 60 * 1000; // 7 days
  return 21 * 24 * 60 * 60 * 1000;               // 21 days
}
```

Key rules:
- `applyCorrect` in "world" context gives a LARGER boost (0.15 vs 0.10) — the world is more effective
- `applyWrong` in "world" context gives a SMALLER penalty (0.10 vs 0.20) — the world is more forgiving
- The boost formula is `boost * (1 - strength)` — diminishing returns as strength approaches 1.0
- `intervalMs` determines when the word is next due for review

### 3.3 Verification — Stage 3

Run these checks (e.g., via a temporary test script or in-line Node):

- [ ] `applyCorrect({ word_id: "test", strength: 0.5, due_ts: 0, seen: 3, correct: 2, wrong: 1 }, "lesson")` returns `strength` ≈ 0.55 (exactly: 0.5 + 0.10 * 0.5 = 0.55)
- [ ] `applyCorrect` with `context: "world"` on the same input returns `strength` ≈ 0.575 (0.5 + 0.15 * 0.5 = 0.575)
- [ ] `applyWrong` with strength 0.5 and context "lesson" returns strength 0.3 (0.5 - 0.20 = 0.3)
- [ ] `applyWrong` with strength 0.5 and context "world" returns strength 0.4 (0.5 - 0.10 = 0.4)
- [ ] `applyCorrect` with strength 1.0 returns strength exactly 1.0 (clamped)
- [ ] `applyWrong` with strength 0.0 returns strength exactly 0.0 (clamped)
- [ ] File compiles: `npx tsc --noEmit src/lib/srs.ts`

---

## STAGE 4: Redis Client & Seed Data

### 4.1 Objective
Create the Redis client with helper functions and a seed script to populate demo data.

### 4.2 Redis client — `src/lib/redis.ts`

```typescript
import Redis from "ioredis";
import { LearnerProfile, WordStrength } from "./types";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
export default redis;

// Key patterns:
// learner:{uid}:profile         → JSON string of LearnerProfile
// learner:{uid}:word:{word_id}  → JSON string of WordStrength

export async function getProfile(uid: string): Promise<LearnerProfile | null> {
  const data = await redis.get(`learner:${uid}:profile`);
  return data ? JSON.parse(data) : null;
}

export async function setProfile(uid: string, profile: LearnerProfile): Promise<void> {
  await redis.set(`learner:${uid}:profile`, JSON.stringify(profile));
}

export async function getWordStrength(uid: string, wordId: string): Promise<WordStrength | null> {
  const data = await redis.get(`learner:${uid}:word:${wordId}`);
  return data ? JSON.parse(data) : null;
}

export async function setWordStrength(uid: string, ws: WordStrength): Promise<void> {
  await redis.set(`learner:${uid}:word:${ws.word_id}`, JSON.stringify(ws));
}

export async function getAllWordStrengths(uid: string, wordIds: string[]): Promise<WordStrength[]> {
  if (wordIds.length === 0) return [];
  const keys = wordIds.map((id) => `learner:${uid}:word:${id}`);
  const results = await redis.mget(...keys);
  return results
    .filter((r): r is string => r !== null)
    .map((r) => JSON.parse(r) as WordStrength);
}
```

### 4.3 Seed script — `src/lib/seed.ts`

This script is run via `npx tsx src/lib/seed.ts`. It populates Redis with a demo learner profile and word strengths for the kitchen unit.

Seed data:
- **Profile:** uid "demo", xp 340, streak 6, hearts 3, last_active today's ISO date, unit_progress: `{ kitchen_1: "current", cafe_1: "locked" }`
- **Word strengths** for kitchen vocab (note: "table" and "chaise" are weak — these will be the missed words the world targets):
  - table: strength 0.25
  - chaise: strength 0.30
  - four: strength 0.80
  - refrigerateur: strength 0.65
  - evier: strength 0.60
  - cuisiniere: strength 0.70
  - poele: strength 0.55
  - marmite: strength 0.50
  - etagere: strength 0.75
  - fenetre: strength 0.85

Each word strength also needs: `due_ts: Date.now()`, `seen: 5`, `correct` and `wrong` values proportional to their strength (e.g., for strength 0.80 with 5 seen: correct=4, wrong=1).

The script should:
1. Import `redis` from `./redis`
2. Set the profile
3. Set all 10 word strengths
4. Log what it did
5. Call `redis.disconnect()` before exiting (otherwise the script hangs)

### 4.4 Verification — Stage 4

- [ ] `docker compose ps` shows redis is running
- [ ] Running `npx tsx src/lib/seed.ts` completes without errors and logs the seeded data
- [ ] Running `docker exec -it $(docker compose ps -q redis) redis-cli GET learner:demo:profile` returns valid JSON with `uid: "demo"`, `xp: 340`
- [ ] Running `docker exec -it $(docker compose ps -q redis) redis-cli GET learner:demo:word:table` returns JSON with `strength: 0.25`
- [ ] File compiles: `npx tsc --noEmit src/lib/redis.ts`

---

## STAGE 5: Zustand Stores

### 5.1 Objective
Create two Zustand stores: one for lesson state, one for world state.

### 5.2 Implementation — `src/lib/store.ts`

Create two stores using Zustand's `create` function:

**LessonStore:**
```typescript
interface LessonStore {
  exerciseIndex: number;       // current exercise (0-indexed)
  totalExercises: number;      // always 8
  hearts: number;              // starts at 3
  xp: number;                  // earned this lesson
  missedWordIds: string[];     // de-duped
  currentExercise: ExercisePayload | null;
  feedbackState: "idle" | "correct" | "wrong";
  setExercise: (e: ExercisePayload) => void;
  addMissed: (wordId: string) => void;
  loseHeart: () => void;
  addXp: (n: number) => void;
  setFeedback: (f: "idle" | "correct" | "wrong") => void;
  advanceIndex: () => void;
  reset: () => void;
}
```

- `addMissed` must de-duplicate using `new Set([...existing, wordId])`
- `loseHeart` must clamp at 0 (never go negative)
- `reset` sets ALL fields back to initial values

**WorldStore:**
```typescript
interface WorldStore {
  cards: WorldCardData[];
  strengthUpdates: Record<string, number>;  // word_id → new strength
  addCard: (card: WorldCardData) => void;
  updateCard: (id: string, updates: Partial<WorldCardData>) => void;
  removeCard: (id: string) => void;
  updateStrength: (wordId: string, strength: number) => void;
  reset: () => void;
}
```

- `addCard` keeps max 2 visible cards: `cards: [...s.cards.slice(-1), card]` — this drops the oldest if there are already 2
- `updateCard` finds the card by `id` and merges the `updates` into it. Used to asynchronously add `authentic_sentence` and `authentic_source` after LinkUp responds.
- `removeCard` filters by `id`

### 5.3 Verification — Stage 5

- [ ] File compiles: `npx tsc --noEmit src/lib/store.ts`
- [ ] Both `useLessonStore` and `useWorldStore` are exported
- [ ] `useLessonStore.getState().reset()` sets exerciseIndex to 0, hearts to 3, xp to 0, missedWordIds to [], currentExercise to null, feedbackState to "idle"
- [ ] `useWorldStore.getState().addCard(card)` followed by another `addCard` results in exactly 2 cards (the older one and the newest)
- [ ] Three `addCard` calls result in exactly 2 cards (the second and third)

---

## STAGE 6: API Routes

### 6.1 Objective
Implement the three core Redis API routes and the Gemini token route. These are Next.js App Router route handlers.

### 6.2 `/api/redis/profile/route.ts`

- **GET** with query param `?uid=demo`
- Read the `LearnerProfile` from Redis using `getProfile(uid)`
- If not found, return a default profile: `{ uid, xp: 0, streak: 0, hearts: 3, last_active: new Date().toISOString(), unit_progress: { kitchen_1: "current", cafe_1: "locked" } }`
- Return as JSON with status 200

### 6.3 `/api/redis/update-strength/route.ts`

- **POST** with body: `{ uid: string, word_id: string, result: "boost" | "penalize" }`
- Read current `WordStrength` from Redis via `getWordStrength(uid, word_id)`
- If not found, create a default: `{ word_id, strength: 0.5, due_ts: Date.now(), seen: 0, correct: 0, wrong: 0 }`
- If `result === "boost"`: apply `applyCorrect(ws, "world")` from srs.ts
- If `result === "penalize"`: apply `applyWrong(ws, "world")` from srs.ts
- Write the updated WordStrength back to Redis via `setWordStrength`
- Return: `{ word_id, new_strength: updated.strength }`

### 6.4 `/api/redis/save-word/route.ts`

- **POST** with body: `{ uid: string, word_id: string, word: string, translation: string, gender?: string }`
- Create a new WordStrength: `{ word_id, strength: 0.3, due_ts: Date.now(), seen: 0, correct: 0, wrong: 0 }`
- Write to Redis
- Return: `{ success: true }`

### 6.5 `/api/gemini-token/route.ts`

- **GET** — no auth (hackathon only)
- Return: `{ apiKey: process.env.GEMINI_API_KEY }`
- If env var is empty, return `{ apiKey: "" }` (don't crash)

### 6.6 Verification — Stage 6

After seeding Redis (Stage 4), test each route:

- [ ] `curl http://localhost:3000/api/redis/profile?uid=demo` returns JSON with `xp: 340`, `streak: 6`
- [ ] `curl -X POST http://localhost:3000/api/redis/update-strength -H "Content-Type: application/json" -d '{"uid":"demo","word_id":"table","result":"boost"}'` returns `new_strength` > 0.25 (should be ≈ 0.3625)
- [ ] `curl -X POST http://localhost:3000/api/redis/save-word -H "Content-Type: application/json" -d '{"uid":"demo","word_id":"test_word","word":"le test","translation":"test"}'` returns `{ "success": true }`
- [ ] `curl http://localhost:3000/api/gemini-token` returns `{ "apiKey": "..." }` (or empty string)
- [ ] All route files compile: `npx tsc --noEmit`
- [ ] The dev server starts without errors: `npm run dev`

---

## STAGE 7: Root Layout & Global Styles

### 7.1 Objective
Set up the Next.js App Router root layout with global CSS design tokens and the Inter font.

### 7.2 `src/app/layout.tsx`

- Use `next/font/google` to load the Inter font
- Set viewport meta for mobile
- Import `globals.css`
- Do NOT wrap in CopilotProvider (only the lesson page needs it)
- Set page title: "Loci Lingua"

### 7.3 `src/styles/globals.css`

Define design tokens as CSS custom properties:
- `--color-accent`: `#6366f1` (indigo)
- `--color-bg`: `#f8f7ff` (very light purple)
- `--color-bg-end`: `#eef0ff` (gradient endpoint)
- `--color-text`: `#1e1b4b` (dark indigo)
- Set `body` background to a gradient from `--color-bg` to `--color-bg-end`
- Set default font family to the Inter variable from layout
- Include Tailwind CSS directives if using Tailwind, OR write clean vanilla CSS/CSS modules. Pick one approach and stick with it.
- Reset: `* { box-sizing: border-box; margin: 0; padding: 0; }`

### 7.4 Verification — Stage 7

- [ ] `npm run dev` starts without errors
- [ ] Opening `http://localhost:3000` in a browser shows a blank page with the correct background gradient (light purple to light blue)
- [ ] The page title in the browser tab reads "Loci Lingua"
- [ ] Viewing the page source shows the Inter font is loaded
- [ ] No console errors in the browser

---

## STAGE 8: Path Map (Home Page)

### 8.1 Objective
Build the path map home page — a Duolingo-style vertical winding path of unit nodes.

### 8.2 `src/app/page.tsx`

- This is a client component (it uses hooks)
- On mount, fetch the learner profile from `/api/redis/profile?uid=demo`
- Import the course data from `data/courses/fr.json` (use a dynamic import or direct import since it's a JSON file)
- Render `<PathMap units={course.units} progress={profile.unit_progress} xp={profile.xp} streak={profile.streak} />`

### 8.3 `src/components/PathMap.tsx`

**Props:** `units: Unit[]`, `progress: Record<string, "locked" | "current" | "complete">`, `xp: number`, `streak: number`

**Visual spec — make this look like a polished consumer app:**

1. **Sticky header bar (fixed at top):**
   - Left: 🔥 emoji + streak day count (e.g., "🔥 6")
   - Right: XP total with animated number (framer-motion `AnimatePresence` + slide-up digits on change)
   - Background: white/translucent with backdrop blur, subtle bottom border

2. **SVG path:** A gentle S-curve drawn with an SVG `<path>` element down the center of the viewport. Use a cubic bezier that weaves left-right. The path itself is visible as a faint dashed line (#e2e8f0).

3. **Unit nodes** positioned along the path at even intervals:
   - Large circles, 64px diameter
   - `"locked"`: grey background `#d1d5db`, no pointer events, small 🔒 text below
   - `"current"`: white background, pulsing ring animation (framer-motion `animate={{ scale: [1, 1.08, 1] }}` with `repeat: Infinity`), drop shadow `0 4px 14px rgba(99,102,241,0.3)`, tappable — navigates to `/lesson/${unit.unit_id}` via `router.push`
   - `"complete"`: gold background `#fbbf24`, white ✓ checkmark overlay
   - Each node shows the unit's emoji icon centered inside

4. **Unit label:** below each node, the `unit.title` in 14px semibold, max-width 120px, text-center

5. **Styling:** rounded corners everywhere, soft shadows, indigo accent `#6366f1`

### 8.4 Verification — Stage 8

- [ ] Opening `http://localhost:3000` shows the path map
- [ ] The header shows "🔥 6" and "340 XP" (matching seed data)
- [ ] Two unit nodes are visible: Kitchen (🍳) and Café (☕)
- [ ] Kitchen node has a pulsing animation (it's "current")
- [ ] Café node is grey with a 🔒 (it's "locked")
- [ ] Clicking the Kitchen node navigates to `/lesson/kitchen_1`
- [ ] Clicking the Café node does nothing (locked)
- [ ] The SVG path is visible connecting the nodes
- [ ] The overall look is polished — no raw/unstyled HTML elements

---

## STAGE 9: Lesson HUD

### 9.1 Objective
Build the progress bar and hearts display for the lesson view.

### 9.2 `src/components/LessonHUD.tsx`

This component reads from `useLessonStore` — it NEVER writes state. It renders as a fixed bar at the top of the lesson page.

**Contents:**
1. **Progress dots:** A horizontal row of 8 dots.
   - Completed (index < exerciseIndex): filled indigo `#6366f1`
   - Current (index === exerciseIndex): pulsing indigo with scale animation
   - Upcoming (index > exerciseIndex): empty/outlined, grey `#d1d5db`

2. **Hearts:** 3 heart icons (❤️ or use SVG hearts) on the right side.
   - When a heart is lost (`hearts` value decreases), the lost heart should animate: scale up 1.3x → shake (rotate ±5°) → fade to grey. Use framer-motion's `animate` with a sequence. Duration ~400ms.
   - Grey hearts represent lost hearts. Red hearts represent remaining hearts.

3. **XP popup:** When `xp` value increases, show "+10 XP" text that floats upward (y: 0→-30) and fades out (opacity: 1→0) over 800ms. Positioned near the top-right area. Use framer-motion `AnimatePresence` + `motion.div` with `exit` animation.

### 9.3 Verification — Stage 9

To test, temporarily modify the lesson page to render `<LessonHUD />` with hardcoded store values. Then:

- [ ] 8 dots render in a row
- [ ] Adjusting `exerciseIndex` in the store shows dots filling in
- [ ] Calling `loseHeart()` triggers the heart death animation
- [ ] Calling `addXp(10)` shows the "+10 XP" float-up text
- [ ] The HUD is fixed at the top and doesn't scroll with content
- [ ] File compiles without errors

---

## STAGE 10: Exercise Renderer Components

### 10.1 Objective
Build all four exercise UI components. They render exercises and call `onSubmit` — they NEVER judge correctness (the agent does that). Also build the lesson-complete screen.

### 10.2 Shared contract

Each exercise component receives:
- Its specific exercise payload as props (typed from `types.ts`)
- `onSubmit: (exerciseId: string, response: any) => void`
- The parent controls `feedbackState` from `useLessonStore` — when it changes to "correct" or "wrong", the component shows visual feedback

### 10.3 `src/components/exercises/MultipleChoice.tsx`

**Props:** `exercise: MultipleChoiceExercise`, `onSubmit: (id: string, response: any) => void`, `feedbackState: "idle" | "correct" | "wrong"`

**Renders:**
- `exercise.prompt` at the top in large text (24px bold)
- If `exercise.audio_url` is present: a 🔊 button that plays it via `new Audio(audio_url).play()`
- 4 option cards in a 2×2 grid: each card is rounded, bordered, padded, with the option text centered
- On tap: highlight the tapped option (indigo border), disable further taps, call `onSubmit(exercise.exercise_id, { selected_idx: tappedIndex })`
- When `feedbackState` changes to `"correct"`: flash the correct option (index === `answer_idx`) green (#22c55e) with a scale-up micro-animation
- When `feedbackState` changes to `"wrong"`: shake the selected option (framer-motion rotate ±3° twice), then highlight the correct option green

### 10.4 `src/components/exercises/WordBank.tsx`

**Props:** `exercise: WordBankExercise`, `onSubmit: (id: string, response: any) => void`, `feedbackState: "idle" | "correct" | "wrong"`

**Renders:**
- `exercise.prompt_en` at the top ("Translate: The oven is hot")
- **Answer row:** a bordered placeholder area (min-height 48px, dashed border when empty). Tiles placed here are shown in order.
- **Tile grid:** below the answer row. Shows all `exercise.tiles` as tappable chip buttons (rounded-full, bg-grey-100, border, padded).
- Tapping a tile in the grid moves it to the answer row (use framer-motion `layoutId` on each tile for smooth animation between positions)
- Tapping a tile in the answer row moves it back to the grid
- **"Check" button:** below the tile grid. Disabled when answer row is empty. On tap: `onSubmit(exercise.exercise_id, { selected_tiles: [ordered tile texts from answer row] })`
- Feedback "correct": answer row background flashes green briefly (300ms)
- Feedback "wrong": answer row shakes (x: [0, -5, 5, -5, 0] over 300ms), then briefly show the correct answer tiles in green below

### 10.5 `src/components/exercises/Listening.tsx`

**Props:** `exercise: ListeningExercise`, `onSubmit: (id: string, response: any) => void`, `feedbackState: "idle" | "correct" | "wrong"`

**Renders:**
- Large 🔊 button (64px, round, indigo bg) that plays `exercise.audio_url` via `new Audio()`. Auto-play once on mount.
- 3 option cards in a single column (each full-width, rounded, bordered, 48px tall)
- On tap: highlight, disable further taps, `onSubmit(exercise.exercise_id, { selected_idx: tappedIndex })`
- Feedback: same as MultipleChoice — green flash for correct, shake + green highlight for wrong

### 10.6 `src/components/exercises/SpeakIt.tsx`

**Props:** `exercise: SpeakItExercise`, `onSubmit: (id: string, response: any) => void`, `feedbackState: "idle" | "correct" | "wrong"`

**Renders:**
- `exercise.target_text` in large text (28px bold) at the top
- A 🔊 button that speaks the text using `window.speechSynthesis` with a `SpeechSynthesisUtterance` set to `lang: "fr-FR"`
- A mic button below (large, round, red when recording):
  - Uses `webkitSpeechRecognition` or `SpeechRecognition` with `lang: "fr-FR"`
  - On recognition result: display the transcript below the mic, call `onSubmit(exercise.exercise_id, { spoken: transcript })`
- **Fallback:** If `SpeechRecognition` is not available (check on mount), render a text input + Submit button instead
- Feedback "correct": green checkmark + "Bien joué !" text
- Feedback "wrong": show both the target and what was heard, side by side, with differences highlighted (simple: red text for the spoken, green for the target)

### 10.7 Lesson Complete renderer

When the store receives an exercise with `type: "lesson.complete"`, render a full-screen completion card:

- Full-screen card centered on the viewport
- Radial gradient pulse animation in the background (framer-motion scale 0.8→1.2 infinite, opacity 0.3)
- "Lesson Complete!" heading (32px bold)
- XP counter animating from 0 up to `xp_gained` (use a counter animation, e.g., framer-motion `useMotionValue` + `useTransform`, or just a `useEffect` with `requestAnimationFrame`)
- If `missed_word_ids` is non-empty: list them below in a subtle red/orange color with text: "Let's find these in the world!"
- Large CTA button: **"Enter the [unit_title] →"** (indigo background, white text, rounded-xl, padded, prominent). Example: "Enter the Kitchen →"
- Tapping the CTA: triggers `<PortalTransition>`, then navigates to `/world/${world_id}?missed=${missed_word_ids.join(",")}`

### 10.8 Verification — Stage 10

Test each component by temporarily rendering them in the lesson page with HARDCODED exercise payloads (do not wire to the agent yet):

- [ ] MultipleChoice renders 4 options in a 2×2 grid, tapping one highlights it and calls onSubmit
- [ ] Setting feedbackState to "correct" shows green flash; "wrong" shows shake + correct answer
- [ ] WordBank renders tiles, tiles move between grid and answer row with animation, Check button calls onSubmit
- [ ] Listening renders 🔊 button + 3 options, audio auto-plays on mount (or attempts to)
- [ ] SpeakIt renders target text + mic button (or text input fallback in Firefox)
- [ ] Lesson complete card shows XP counter animation and the CTA button with the correct unit title
- [ ] All components are disabled after submission (no double-submit)
- [ ] All files compile without TypeScript errors

---

## STAGE 11: Lesson Director Agent (Python Backend)

### 11.1 Objective
Create the Google ADK agent that plans and runs lessons, and the FastAPI server that hosts it as a CopilotKit AG-UI runtime.

### 11.2 `services/agents/lesson_director.py`

Create the agent using Google ADK. The agent is named `lesson_director`.

**System prompt** (use EXACTLY this — it's the core lesson logic):

```
You are the Lesson Director for Loci Lingua, a language-learning app. You run one lesson at a time.

INPUTS you receive at the start of a lesson:
- The unit's vocabulary list (word_id, target language word, English translation, gender, distractors)
- The unit's sentence list (target, English, tiles, answer)
- The learner's current strength for each word (0.0-1.0 scale)

YOUR JOB:
Plan and execute a sequence of exactly 8 exercises for this lesson. You emit one exercise at a time as a structured payload. After the learner submits their answer, you judge it, update their score, and emit the next exercise or the lesson-complete signal.

EXERCISE PLANNING RULES:
1. Start with the 2 weakest words (lowest strength). Introduce each with a multiple_choice exercise.
2. Follow each introduction with a word_bank sentence exercise that uses that word.
3. Mix in listening exercises for medium-strength words.
4. Include at least one speak_it exercise in the second half if the learner is doing well (≤1 wrong so far).
5. End with exercise 8 — after judging it, emit a lesson.complete payload.
6. Never repeat the same word_id in two consecutive exercises.
7. Track which word_ids the learner got wrong. Include ALL of them in the lesson.complete missed_word_ids array.

EXERCISE PAYLOAD FORMATS — emit these as the render action argument, exactly as shown:

For multiple_choice:
{"type":"exercise.multiple_choice","exercise_id":"e1","word_id":"table","prompt":"Which one is 'table'?","options":["la table","le comptoir","le bureau","l'étagère"],"answer_idx":0}

For word_bank:
{"type":"exercise.word_bank","exercise_id":"e2","prompt_en":"The oven is hot","tiles":["Le","four","est","chaud","froid","La"],"answer":["Le","four","est","chaud"]}

For listening:
{"type":"exercise.listening","exercise_id":"e3","word_id":"marmite","audio_url":"/tts/la-marmite.mp3","options":["la marmite","la casserole","la cocotte"],"answer_idx":0}

For speak_it:
{"type":"exercise.speak_it","exercise_id":"e4","target_text":"la cuisinière"}

For lesson complete:
{"type":"lesson.complete","xp_gained":35,"missed_word_ids":["table","marmite"],"world_id":"kitchen_fr","unit_title":"In the Kitchen"}

JUDGING RULES:
- multiple_choice: correct if submitted selected_idx === answer_idx
- word_bank: correct if submitted selected_tiles === answer (exact array match, case-insensitive)
- listening: correct if submitted selected_idx === answer_idx
- speak_it: correct if the spoken text matches target_text with ≥70% character overlap (be lenient with accents)
- On correct: award 10 XP. Respond briefly in the target language: "Bien joué !" / "Exactement !" / "Parfait !"
- On wrong: do NOT deduct XP but note the word_id as missed. Respond: "Presque — [correct answer]. [brief tip about gender/spelling]."
- After judging, ALWAYS emit the next exercise payload immediately. Never leave the learner waiting.

XP CALCULATION for lesson.complete:
- Base: 5 XP per correct answer
- Bonus: +10 if ≤1 wrong, +5 if ≤2 wrong
- Include the total as xp_gained
```

### 11.3 `services/agents/server.py`

Set up a FastAPI server that hosts the Lesson Director as a CopilotKit AG-UI runtime:

- Import the CopilotKit SDK's ADK adapter (leave a `# TODO: VERIFY FROM HACKATHON TEMPLATE` comment at the adapter import)
- The agent registers a `useCopilotAction` called `show_exercise` that takes the exercise payload as its argument
- Standard endpoint at `/copilotkit` (or whatever the CopilotKit adapter requires)
- Run with uvicorn on port 8000

### 11.4 `src/app/api/copilotkit/route.ts`

Forward requests to the FastAPI agent server at `http://localhost:8000/copilotkit`. This is the standard CopilotKit runtime proxy pattern — a POST handler that proxies the request body and streams the response back.

### 11.5 Verification — Stage 11

- [ ] `cd services/agents && pip install -r requirements.txt` completes
- [ ] `cd services/agents && python -c "from lesson_director import *"` imports without error
- [ ] Running `uvicorn server:app --port 8000` starts the server (may show the TODO warning, that's fine)
- [ ] The CopilotKit route at `/api/copilotkit` is defined and proxies to port 8000
- [ ] All TypeScript files compile

---

## STAGE 12: Lesson Page (Wiring It All Together)

### 12.1 Objective
Connect the lesson page to the agent, exercise renderers, and lesson HUD into a complete working lesson flow.

### 12.2 `src/app/lesson/[unitId]/page.tsx`

This is the full lesson experience page. Implementation:

1. **Load data on mount:**
   - Get `unitId` from route params
   - Load the unit from `fr.json` by matching `unit_id`
   - Fetch word strengths from the Redis API for that unit's vocab

2. **Wrap in CopilotKit provider:**
   - `<CopilotKitProvider runtimeUrl="/api/copilotkit">`
   - Pass the unit data + word strengths as initial context to the agent (through CopilotKit's context mechanism)

3. **Register the `show_exercise` action:**
   - Use `useCopilotAction("show_exercise", handler)` (or equivalent CopilotKit hook)
   - The handler receives the exercise payload (typed as `ExercisePayload`)
   - It calls `useLessonStore.getState().setExercise(payload)` and `advanceIndex()`

4. **Render the current exercise:**
   - Read `currentExercise` from `useLessonStore`
   - Based on `currentExercise.type`, render the corresponding exercise component
   - Pass `onSubmit` callback that sends the response back through CopilotKit's action result channel

5. **Handle feedback:**
   - When the agent sends back a judgment (next message after submission), parse whether it's correct or wrong
   - Set `feedbackState` on the store → wait 1500ms → set `feedbackState` back to "idle" → render next exercise
   - If wrong: also call `addMissed(word_id)` and `loseHeart()`
   - If correct: call `addXp(10)`

6. **Lesson complete:**
   - When `currentExercise.type === "lesson.complete"`, render the completion card (from Stage 10.7)

7. **Preload the world file:**
   - When `exerciseIndex >= totalExercises - 2` (i.e., exercise 7 or 8), start a hidden `fetch()` for `/worlds/${unit.world_id}.spz`
   - This warms the browser cache so the portal transition is instant

8. **Show `<LessonHUD />`** at the top throughout the entire lesson.

### 12.3 Verification — Stage 12

- [ ] Navigating to `/lesson/kitchen_1` shows the LessonHUD and begins the lesson
- [ ] The agent emits exercises and they render correctly
- [ ] Submitting an answer sends the response to the agent
- [ ] Correct answers show green feedback + "+10 XP" animation
- [ ] Wrong answers show shake/red feedback + heart loss animation
- [ ] After 8 exercises, the lesson-complete card appears with XP total and missed words
- [ ] The CTA button text includes the unit title ("Enter the Kitchen →")
- [ ] Network tab shows a fetch for the `.spz` file starting during exercise 7 or 8
- [ ] If the agent server is down, the page shows a graceful error state (not a crash)

---

## STAGE 13: Spark.js 3D Scene

### 13.1 Objective
Render a Gaussian splat `.spz` file with FPS camera controls. Ensure `canvas.toDataURL()` works (required for Gemini Live).

### 13.2 `src/components/SplatScene.tsx`

**Props:**
- `splatUrl: string` — path to the .spz file (e.g., "/worlds/kitchen_fr.spz")
- `canvasRef: React.RefObject<HTMLCanvasElement>` — exposed so GeminiLiveController can grab frames
- `spawnPosition?: [number, number, number]` — default `[0, 1.6, 3]`

**Implementation:**

1. Create a `<canvas>` element that fills the viewport (100vw × 100vh, position absolute, z-index 0)
2. On mount, set up Three.js:
   - `THREE.WebGLRenderer` with `{ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }` ← **CRITICAL: `preserveDrawingBuffer: true` is required or `canvas.toDataURL()` returns blank**
   - `THREE.PerspectiveCamera` with fov 60, aspect from window dimensions, near 0.1, far 1000
   - `THREE.Scene`
3. Create a `SparkRenderer` wrapping the Three.js renderer (follow Spark.js docs)
4. Load the splat: `new SplatMesh({ url: splatUrl })` → add to scene
5. Set up FPS controls:
   - Import `PointerLockControls` from `three/addons/controls/PointerLockControls.js`
   - On canvas click: `controls.lock()`
   - WASD for movement (listen to keydown/keyup, track velocity, apply in render loop)
   - Mouse movement handled by PointerLockControls
6. Set camera position to `spawnPosition` prop (default `[0, 1.6, 3]`), look at `[0, 1, 0]`
7. Render loop:
   ```
   requestAnimationFrame(loop)
   update movement based on key state
   sparkRenderer.render(scene, camera)
   renderer.render(scene, camera)
   ```
8. On unmount: dispose renderer, remove event listeners, cancel animation frame
9. Handle window resize: update camera aspect + renderer size

### 13.3 Verification — Stage 13

- [ ] Placing a `.spz` file in `public/worlds/` and rendering `<SplatScene splatUrl="/worlds/kitchen_fr.spz" canvasRef={ref} />` shows the 3D scene
- [ ] If no `.spz` file is available yet, test with a simple Three.js scene (colored cube) to verify the canvas setup works
- [ ] Clicking the canvas locks the pointer (FPS mode)
- [ ] WASD moves the camera
- [ ] Mouse movement looks around
- [ ] **CRITICAL TEST:** In browser console, run `document.querySelector('canvas').toDataURL('image/jpeg', 0.7')` — it should return a non-trivial base64 string (NOT a blank/black image). If it returns a blank image, `preserveDrawingBuffer` is not set correctly.
- [ ] Component cleans up on unmount (no memory leaks)

---

## STAGE 14: Gemini Live Client & Frame Capture

### 14.1 Objective
Implement the WebSocket client for Gemini Live API and the frame capture utility.

### 14.2 `src/lib/frame-capture.ts`

```typescript
export function startFrameCapture(
  canvas: HTMLCanvasElement,
  onFrame: (base64: string) => void,
  intervalMs: number = 1000
): () => void {
  const id = setInterval(() => {
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const base64 = dataUrl.split(",")[1];
      if (base64) onFrame(base64);
    } catch (e) {
      console.warn("Frame capture failed:", e);
    }
  }, intervalMs);
  return () => clearInterval(id);
}
```

### 14.3 `src/lib/gemini-live.ts`

Implement the `GeminiLiveClient` class. This manages the WebSocket connection to Gemini's Live API.

**WebSocket URL:** `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`

**Config interface:**
```typescript
interface GeminiLiveConfig {
  apiKey: string;
  systemInstruction: string;
  tools: any[];
  onAudio: (pcmData: ArrayBuffer) => void;
  onText: (text: string) => void;
  onToolCall: (id: string, name: string, args: any) => Promise<any>;
  onInterrupted: () => void;
}
```

**Class methods:**

- `constructor(config)` — stores config
- `connect()` — opens WebSocket to `${WS_URL}?key=${apiKey}`, calls `sendSetup()` on open
- `sendSetup()` — sends the setup message:
  ```json
  {
    "setup": {
      "model": "models/gemini-2.5-flash-live-preview",
      "generationConfig": {
        "responseModalities": ["AUDIO", "TEXT"],
        "speechConfig": {
          "voiceConfig": {
            "prebuiltVoiceConfig": { "voiceName": "Aoede" }
          }
        }
      },
      "systemInstruction": { "parts": [{ "text": "..." }] },
      "tools": [...]
    }
  }
  ```
- `sendFrame(base64Jpeg)` — sends `{ realtimeInput: { mediaChunks: [{ mimeType: "image/jpeg", data: base64Jpeg }] } }`
- `sendAudio(base64Pcm)` — sends `{ realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm", data: base64Pcm }] } }`
- `sendToolResponse(callId, response)` — sends `{ toolResponse: { functionResponses: [{ id: callId, response }] } }`
- `handleMessage(msg)` — dispatches incoming messages:
  - `msg.setupComplete` → log "Gemini Live session ready"
  - `msg.serverContent.modelTurn.parts[]` → for each part: if `inlineData` with audio mime → decode base64 to ArrayBuffer → call `onAudio`; if `text` → call `onText`
  - `msg.serverContent.interrupted` → call `onInterrupted`
  - `msg.toolCall.functionCalls[]` → for each: call `onToolCall(call.id, call.name, call.args)`, then `sendToolResponse(call.id, { result: JSON.stringify(returnValue) })`
- `disconnect()` — closes WebSocket, sets to null

### 14.4 Verification — Stage 14

- [ ] `src/lib/frame-capture.ts` compiles
- [ ] `src/lib/gemini-live.ts` compiles
- [ ] The `GeminiLiveClient` class exports correctly
- [ ] `startFrameCapture` returns a cleanup function
- [ ] (If GEMINI_API_KEY is set) Creating a client and calling `connect()` establishes a WebSocket connection and logs "Gemini Live session ready" in the console after setup

---

## STAGE 14A: LinkUp AI — Authentic Example Sentences

### 14A.1 Objective
Integrate LinkUp AI to fetch real example sentences from the web for vocabulary words. When a word card is shown in the 3D world, we enrich it with an authentic sentence sourced from real French-language content online (news, blogs, literature). This gives learners exposure to how native speakers actually use the word — not just AI-generated examples.

### 14A.2 Why LinkUp
LinkUp provides a search API that retrieves and summarizes real web content. We use it to find short, natural sentences containing a target French word from authentic sources. This is a lightweight integration — one API route, one utility function, consumed by the existing `show_word_card` tool handler.

### 14A.3 `src/lib/linkup.ts`

Create a utility module that wraps the LinkUp SDK:

```typescript
import { LinkupClient } from "linkup-sdk";

const client = new LinkupClient({ apiKey: process.env.LINKUP_API_KEY });

export interface AuthenticSentence {
  sentence: string;       // a short French sentence using the word
  source: string;         // attribution, e.g. "Le Monde", "RFI", or a domain name
}

/**
 * Search the web for a short, authentic French sentence containing the given word.
 * Returns null if no suitable sentence is found (do not block the UX on failure).
 */
export async function fetchAuthenticSentence(
  frenchWord: string,
  englishTranslation: string
): Promise<AuthenticSentence | null> {
  try {
    const response = await client.search({
      query: `Example sentence in French using the word "${frenchWord}" (meaning: ${englishTranslation})`,
      depth: "standard",
      outputType: "structured",
      structuredOutputSchema: JSON.stringify({
        type: "object",
        properties: {
          sentence: {
            type: "string",
            description: "A single short French sentence (max 15 words) that naturally uses the target word. Must be grammatically correct and from real usage."
          },
          source: {
            type: "string",
            description: "The source website or publication name where this usage was found."
          }
        },
        required: ["sentence", "source"]
      })
    });

    const parsed = JSON.parse(response.output);
    if (parsed.sentence && parsed.source) {
      return { sentence: parsed.sentence, source: parsed.source };
    }
    return null;
  } catch (e) {
    console.warn("LinkUp sentence fetch failed:", e);
    return null;
  }
}
```

Key design decisions:
- Uses `depth: "standard"` — fast enough for real-time use (~1-2 seconds)
- Uses `outputType: "structured"` with a JSON schema to get a clean sentence + source back
- **Never blocks the UX:** returns `null` on any error. The card still shows Gemini's example sentence as fallback.
- The query includes both the French word and English meaning to help LinkUp find contextually appropriate results.

### 14A.4 `src/app/api/linkup/example-sentence/route.ts`

API route that the frontend tool handler calls:

- **POST** with body: `{ word: string, translation: string }`
- Calls `fetchAuthenticSentence(word, translation)` from `src/lib/linkup.ts`
- Returns: `{ sentence: string | null, source: string | null }`
- If LinkUp returns null or throws, return `{ sentence: null, source: null }` (never 500)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { fetchAuthenticSentence } from "@/lib/linkup";

export async function POST(req: NextRequest) {
  const { word, translation } = await req.json();

  if (!word || !translation) {
    return NextResponse.json({ sentence: null, source: null });
  }

  const result = await fetchAuthenticSentence(word, translation);
  return NextResponse.json({
    sentence: result?.sentence ?? null,
    source: result?.source ?? null,
  });
}
```

### 14A.5 How it integrates with the world flow

The `show_word_card` tool handler (in Stage 15, `GeminiLiveController`) will call this route **asynchronously after creating the card**. The flow is:

1. Gemini calls `show_word_card` with `{ word, translation, ... }`
2. The handler immediately creates the card and adds it to the store (so it appears instantly)
3. In parallel, it fires a fetch to `/api/linkup/example-sentence` with the word/translation
4. When the response arrives (1-2 sec later), it updates the card's `authentic_sentence` and `authentic_source` fields in the store
5. The `WorldCard` component reactively shows the authentic sentence when it appears (with a subtle fade-in)

This means:
- Cards appear instantly (no waiting for LinkUp)
- The authentic sentence fades in shortly after as enrichment
- If LinkUp fails, the card still works fine with just Gemini's example sentence

### 14A.6 Verification — Stage 14A

- [ ] `src/lib/linkup.ts` compiles without errors
- [ ] `src/app/api/linkup/example-sentence/route.ts` compiles without errors
- [ ] (If LINKUP_API_KEY is set) `curl -X POST http://localhost:3000/api/linkup/example-sentence -H "Content-Type: application/json" -d '{"word":"la table","translation":"table"}'` returns a JSON response with a `sentence` field containing a French sentence that uses "table", and a `source` field
- [ ] If LINKUP_API_KEY is empty/missing, the route returns `{ "sentence": null, "source": null }` (does not crash)
- [ ] The response time is under 3 seconds

---

## STAGE 15: Gemini Live Controller (World Mode Wiring)

### 15.1 Objective
Build the component that wires the Gemini Live client to the 3D scene, microphone, audio playback, and tool call handlers.

### 15.2 `src/components/GeminiLiveController.tsx`

**Props:**
- `canvasRef: React.RefObject<HTMLCanvasElement>`
- `missedWordIds: string[]`
- `unitVocab: VocabItem[]`
- `wordStrengths: WordStrength[]`
- `unitTitle: string`

**On mount, in order:**

1. Fetch API key from `/api/gemini-token`
2. Build system instruction by interpolating data into the tutor prompt (see below)
3. Create `GeminiLiveClient` with config (system instruction, tools, callbacks)
4. Call `client.connect()`
5. Start microphone: `navigator.mediaDevices.getUserMedia({ audio: true })` → create `AudioContext` at 16000Hz sample rate → `AudioWorkletNode` that outputs PCM16LE mono chunks → base64-encode → `client.sendAudio(base64)`
6. Start frame capture: `startFrameCapture(canvasRef.current!, client.sendFrame.bind(client), 1000)`
7. Set up audio playback: create an `AudioContext` (output at 24000Hz). On `onAudio` callback: decode the PCM data (24kHz, signed 16-bit LE, mono) into Float32 samples → create an `AudioBuffer` → play through the context.

**System instruction template** (replace `{{...}}` with actual data — do NOT send literal template markers):

```
You are a warm, playful French language tutor. You are inside a 3D scene with the learner. You can SEE the scene through image frames that are sent to you periodically — these are screenshots of what the learner currently sees as they navigate the 3D environment.

CONTEXT:
The learner just completed a lesson on the theme "{{unit_title}}".
They missed these words during the lesson — these are your PRIMARY targets:
{{for each missed word: "- {fr} ({en}, {gender}) — current strength: {strength}"}}

Full vocabulary for this scene (all of these objects should be visually present):
{{for each vocab item: "- {fr} ({en}, {gender})"}}

YOUR BEHAVIOR:
1. GREET the learner warmly in French when the session starts. Mention that you can see what they see.
2. SCAVENGER HUNT MODE: Ask the learner to find missed objects. Confirm when you see them centered in the frame. Call show_word_card AND update_strength on confirmation.
3. POINT-AND-ASK MODE: If the learner asks about something visible, identify it and teach.
4. LANGUAGE RULES: Speak primarily in French. Short responses (1-2 sentences). Use tu.
5. VISUAL GROUNDING: Base responses on what you see in frames. Never claim to see something you're not confident about.
6. TOOL USAGE: Call show_word_card EVERY TIME you teach or confirm a word. Call update_strength EVERY TIME.
```

(The full prompt from the original plan should be used — the above is abbreviated. Use the complete version.)

**Tool declarations** (pass as the `tools` config to GeminiLiveClient):

```typescript
const tools = [{
  functionDeclarations: [
    {
      name: "show_word_card",
      description: "Display a vocabulary card overlaid on the 3D scene.",
      parameters: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          translation: { type: "STRING" },
          gender: { type: "STRING", enum: ["m", "f", "n"] },
          example_sentence: { type: "STRING" },
          position_hint: { type: "STRING", enum: ["center", "top-left", "top-right", "bottom-left", "bottom-right"] }
        },
        required: ["word", "translation", "position_hint"]
      }
    },
    {
      name: "update_strength",
      description: "Update the learner's SRS strength score for a word.",
      parameters: {
        type: "OBJECT",
        properties: {
          word_id: { type: "STRING" },
          result: { type: "STRING", enum: ["boost", "penalize"] }
        },
        required: ["word_id", "result"]
      }
    },
    {
      name: "save_to_deck",
      description: "Save a new word the learner discovered to their study deck.",
      parameters: {
        type: "OBJECT",
        properties: {
          word_id: { type: "STRING" },
          word: { type: "STRING" },
          translation: { type: "STRING" },
          gender: { type: "STRING" }
        },
        required: ["word_id", "word", "translation"]
      }
    }
  ]
}];
```

**Tool call handlers:**

- `show_word_card` → create a `WorldCardData` object with `crypto.randomUUID()` as id, set `authentic_sentence: null` and `authentic_source: null` initially, add to `useWorldStore` via `addCard(card)`. Then **fire-and-forget** (do not await) a fetch to `/api/linkup/example-sentence` with `{ word: args.word, translation: args.translation }`. When the response arrives, call `useWorldStore.getState().updateCard(card.id, { authentic_sentence: data.sentence, authentic_source: data.source })`. Return `{ success: true }` immediately to Gemini (do not wait for LinkUp).
- `update_strength` → POST to `/api/redis/update-strength` with `{ uid: "demo", word_id, result }`, then call `useWorldStore.getState().updateStrength(word_id, data.new_strength)`, return `{ success: true, new_strength }`
- `save_to_deck` → POST to `/api/redis/save-word` with `{ uid: "demo", ...args }`, return `{ success: true }`

**UI elements rendered by this component:**
- Small pulsing red dot (●) in top-left: "Gemini Live connected"
- Mic mute/unmute toggle button (bottom-right)
- Subtitle bar at the bottom: shows last text from Gemini, fades out after 5 seconds

**On unmount:** stop frame capture interval, stop mic stream (all tracks), call `client.disconnect()`

### 15.3 Verification — Stage 15

- [ ] Component compiles without TypeScript errors
- [ ] On mount (with a valid API key), it connects to Gemini Live WebSocket
- [ ] Frame capture starts sending JPEG frames every 1 second
- [ ] Microphone permission is requested
- [ ] The red dot indicator appears in the top-left
- [ ] Gemini's voice responses play through the speakers (24kHz PCM)
- [ ] Tool calls from Gemini (show_word_card) result in cards appearing (test in next stage)
- [ ] On unmount, the mic stream stops and WebSocket disconnects

---

## STAGE 16: World Cards & World HUD

### 16.1 Objective
Build the overlay components for the 3D world — vocabulary cards and the progress HUD.

### 16.2 `src/components/WorldCard.tsx`

Reads from `useWorldStore.cards`. For each card, render:

**Positioning** (absolute positioning within the viewport based on `position_hint`):
- `"center"`: `top: 40%, left: 50%, transform: translate(-50%, -50%)`
- `"top-left"`: `top: 20%, left: 5%`
- `"top-right"`: `top: 20%, right: 5%`
- `"bottom-left"`: `bottom: 25%, left: 5%`
- `"bottom-right"`: `bottom: 25%, right: 5%`

**Card visual** (glassmorphism style):
- `backdrop-filter: blur(12px)`, `background: rgba(255,255,255,0.85)`, `border-radius: 16px`, `box-shadow: 0 8px 32px rgba(0,0,0,0.1)`, padding 20px
- **Word:** large bold (24px)
- **Translation:** lighter weight (16px), below word
- **Gender chip:** small rounded pill — blue `#3b82f6` for "m", pink `#ec4899` for "f", grey `#9ca3af` for "n"/null. Text shows "m"/"f"/"n".
- **Example sentence:** italic, 14px (if present — this is Gemini's generated example)
- **Authentic sentence (from LinkUp):** if `authentic_sentence` is non-null, show it below the example sentence with a slightly different style: 13px, a small "📖" icon prefix, and a light source attribution in 11px grey text (e.g. "— Le Monde"). This fades in with `opacity 0→1` over 300ms when it arrives (since it loads asynchronously after the card appears). If `authentic_sentence` is null, show nothing — do not show a loading state.
- **▶ Audio button:** plays the word via `SpeechSynthesis` with `lang: "fr-FR"`

**Animations:**
- Enter: framer-motion `initial={{ scale: 0.8, opacity: 0 }}` → `animate={{ scale: 1, opacity: 1 }}`, spring transition
- Auto-dismiss after 15 seconds: fade out opacity to 0, then remove from store
- Max 2 cards visible (enforced by the store's `addCard` method)

### 16.3 `src/components/WorldHUD.tsx`

A small semi-transparent panel in the top-right corner:

- **Words found counter:** "3 / 5 mots trouvés" — count comes from `Object.keys(useWorldStore.strengthUpdates).length` where the value increased (boosts)
- **Per-word strength bars:** for each word that's been updated, show a thin horizontal bar (80px wide, 4px tall):
  - Red (`#ef4444`) if strength < 0.3
  - Orange (`#f97316`) if strength < 0.6
  - Green (`#22c55e`) if strength ≥ 0.6
  - Word label in 12px to the left of the bar
- **Heart restore animation:** on first render, show a "+❤️" float-up animation (entering the world restores one heart)

### 16.4 Verification — Stage 16

Test by manually adding cards/updates to the Zustand store:

- [ ] Calling `useWorldStore.getState().addCard({...})` causes a card to appear with animation
- [ ] Card is positioned correctly based on `position_hint`
- [ ] Card shows word, translation, gender chip, and example sentence
- [ ] Card auto-dismisses after 15 seconds
- [ ] Adding a 3rd card causes the oldest to be removed (max 2)
- [ ] WorldHUD shows "0 / X mots trouvés" initially
- [ ] Calling `updateStrength("table", 0.4)` adds a bar to the HUD
- [ ] The "+❤️" animation plays on mount

---

## STAGE 17: World Page (Full Assembly)

### 17.1 Objective
Assemble the complete world experience page — 3D scene + Gemini Live controller + overlays.

### 17.2 `src/app/world/[worldId]/page.tsx`

1. Read `worldId` from route params (e.g., "kitchen_fr")
2. Read `missed` from search params: `searchParams.get("missed")?.split(",")` — these are the word_ids missed in the lesson
3. Load the unit data from `fr.json` where `unit.world_id === worldId`
4. Load word strengths from the Redis API for that unit's vocab
5. Create a `canvasRef` using `useRef<HTMLCanvasElement>(null)`
6. Render (layered with z-index):
   - **Layer 0:** `<SplatScene splatUrl={"/worlds/${worldId}.spz"} canvasRef={canvasRef} />`
   - **Layer 1 (overlays, pointer-events-none except interactive elements):**
     - `<GeminiLiveController canvasRef={canvasRef} missedWordIds={missed} unitVocab={unit.vocab} wordStrengths={strengths} unitTitle={unit.title} />`
     - `<WorldCard />`
     - `<WorldHUD />`
   - **Layer 2:** Small "Exit world" button (top-left, `position: absolute`, subtle white/translucent, "✕ Exit"). On click: navigate to `/` and reset the world store.

### 17.3 Verification — Stage 17

- [ ] Navigating to `/world/kitchen_fr?missed=table,chaise` loads the page without crashing
- [ ] The 3D scene renders (or a placeholder if .spz not available)
- [ ] Gemini Live connects (red dot visible)
- [ ] Gemini speaks a greeting in French
- [ ] Moving around the scene causes new frames to be sent (check Network/console)
- [ ] When Gemini calls `show_word_card`, a card appears overlaid on the scene
- [ ] When Gemini calls `update_strength`, the HUD updates
- [ ] The "Exit world" button navigates back to the path map
- [ ] Audio from Gemini plays through speakers

---

## STAGE 18: Portal Transition

### 18.1 Objective
Build the cinematic transition animation between the lesson-complete screen and the 3D world.

### 18.2 `src/components/PortalTransition.tsx`

**Props:**
- `worldId: string`
- `missedIds: string[]`
- `onComplete: () => void` (called when transition finishes and navigation should happen)

**Animation sequence** (framer-motion, ~2.5 seconds total):

1. **0–300ms:** The background content scales to 0.9 and blurs (`filter: blur(8px)`). Use a wrapper div with `animate={{ scale: 0.9, filter: "blur(8px)" }}`.

2. **300–1200ms:** A white radial gradient circle expands from the center of the viewport to fill the entire screen. Use a `<motion.div>` with `clipPath: circle(...)` animating from `circle(0% at 50% 50%)` to `circle(150% at 50% 50%)`. White background.

3. **1200–1500ms (during white screen):** Call `router.push(\`/world/${worldId}?missed=${missedIds.join(",")}\`)`. The .spz should already be cached from the preload in Stage 12.

4. **After navigation:** The world page handles its own fade-in. Alternatively, render a white overlay on the world page that fades to transparent over 700ms.

**Sound effect:** During step 2, synthesize a subtle rising tone:
- Create an `OscillatorNode` (sine wave)
- Frequency ramp from 300Hz to 800Hz over 900ms
- Gain envelope: 0 → 0.15 → 0 (fade in, then out) — keep it subtle
- No audio file dependency

### 18.3 Verification — Stage 18

- [ ] Clicking the CTA on the lesson-complete card triggers the portal transition
- [ ] The blur + scale animation plays smoothly
- [ ] The white circle expands to fill the screen
- [ ] A subtle rising tone is audible (not jarring)
- [ ] Navigation to the world page occurs
- [ ] The world loads without showing a loading spinner (because .spz was preloaded)
- [ ] The overall transition feels cinematic, not janky

---

## STAGE 19: End-to-End Integration Test

### 19.1 Objective
Verify the complete flow works from start to finish.

### 19.2 Test flow

1. Open `http://localhost:3000` — path map loads with Kitchen (current) and Café (locked)
2. Tap the Kitchen node → navigates to `/lesson/kitchen_1`
3. Lesson begins — agent emits exercises one by one
4. Complete 8 exercises (mix of correct and wrong answers)
5. Lesson-complete card appears with XP count and missed words
6. Tap "Enter the Kitchen →" → portal transition plays → world loads
7. Gemini Live connects, greets in French, asks you to find missed words
8. Navigate around the 3D scene, Gemini confirms when you find objects
9. Word cards appear, HUD updates with strength bars
10. Tap "Exit world" → back to path map

### 19.3 Verification — Stage 19

- [ ] The full flow completes without crashes
- [ ] Exercise feedback (correct/wrong) displays correctly with animations
- [ ] Hearts decrease on wrong answers
- [ ] XP accumulates correctly
- [ ] Portal transition is smooth (no loading spinner)
- [ ] Gemini Live sees the 3D scene and responds contextually
- [ ] Word cards display correctly in the specified positions
- [ ] Exiting the world returns to the path map
- [ ] Redis data is updated (word strengths change after world mode)

---

## STAGE 20: Memory Place (Stretch Feature)

### 20.1 Objective
Implement the "Store this memory" feature — search a real place, select the best photo via a Gemini vision agent, generate a 360° panorama, practice vocab inside it.

**This entire stage is a stretch goal.** Only attempt after Stages 1–19 are fully working.

### 20.2 New files to create

- `src/components/MemoryPlaceSearch.tsx`
- `src/components/PhotoSelector.tsx`
- `src/components/PanoViewer.tsx`
- `src/app/memory/[placeId]/page.tsx`
- `src/app/api/memory-place/select-photos/route.ts`
- `src/app/api/memory-place/generate/route.ts`
- `src/app/api/memory-place/status/route.ts`

### 20.3 MemoryPlaceSearch component

- Full-screen modal with heading: "Where would you like to store this memory?"
- Subheading: "Search for a place you've been — a café, a kitchen, a station. We'll rebuild it for you."
- Google Places Autocomplete input (Maps JavaScript API, restricted to `type: "establishment"`)
- On place selection: capture `place_id` and `place_name`, show "Finding the best photos…", call `POST /api/memory-place/select-photos`
- Transition to PhotoSelector when response arrives

### 20.4 PhotoSelector component

- Shows agent's top 3 photo picks as a grid of cards
- Each card: photo (cover-fit, rounded-xl), badge (agent's `label` + check), score indicator
- Agent's #1 pick: glowing indigo border + "Recommended" chip
- User taps to select → thick indigo border + checkmark
- "Build this memory" button → calls `POST /api/memory-place/generate`
- Transition to building screen with progress animation

### 20.5 PanoViewer component

360° equirectangular panorama viewer using Three.js:
- `THREE.SphereGeometry(500, 60, 40)` flipped inside-out with `scale(-1, 1, 1)`
- Panorama image as texture on the sphere's material
- `OrbitControls` with `enableZoom: false, enablePan: false, rotateSpeed: -0.3`
- `preserveDrawingBuffer: true` on the renderer (for Gemini frame capture)
- Expose `canvasRef` — GeminiLiveController reads frames from this canvas identically to SplatScene

### 20.6 API routes

**`POST /api/memory-place/select-photos`** — body: `{ place_id, place_name }`
1. Fetch place photos from Google Places API (up to 10)
2. Download all photos server-side at 1024px width
3. Send ALL to Gemini `generateContent` (multi-image request) with the photo selection prompt
4. Parse ranked JSON response
5. Return `{ place_name, address, ranked_photos: [...] }`

**`POST /api/memory-place/generate`** — body: `{ uid, place_name, photo_url, unit_id }`
1. Fetch selected photo
2. Stage 1: Call Marble API for panorama output → store `pano_url` in Redis when done
3. Stage 2: Call Marble API for full .spz world (background) → store `spz_url` in Redis when done
4. Return immediately: `{ place_id, pano_status: "generating" }`

**`GET /api/memory-place/status`** — query: `?uid=demo&place_id=xxx`
1. Check Redis for current status
2. Poll Marble if still generating
3. Return: `{ pano_status, pano_url?, world_status, spz_url? }`

### 20.7 Memory Place world page (`src/app/memory/[placeId]/page.tsx`)

- If `spz_url` exists: render `<SplatScene>`
- If only `pano_url`: render `<PanoViewer>`
- In both cases: render `<GeminiLiveController>` with an additional system instruction line: "The learner chose to practice in {{place_name}}, a real place they have visited."
- Show WorldCard + WorldHUD overlays
- If world still generating: subtle chip in top-left: "Full world generating… check back tomorrow"

### 20.8 Redis keys

```
memory_place:{uid}:{place_id} → JSON {
  place_name, place_id, unit_id, source_photo_url,
  pano_url, pano_status: "generating" | "ready",
  spz_url, world_status: "not_started" | "generating" | "ready",
  world_operation_id, created_at
}
```

### 20.9 Verification — Stage 20

- [ ] Searching for a place returns Google Places suggestions
- [ ] Selecting a place triggers photo fetching and Gemini vision analysis
- [ ] The photo grid shows ranked photos with badges
- [ ] Selecting a photo and tapping "Build this memory" starts generation
- [ ] The panorama loads within ~30 seconds and renders in PanoViewer
- [ ] Looking around works (drag or gyro)
- [ ] Gemini Live connects and can see the panorama frames
- [ ] The full flow works: search → select → build → practice

---

## Critical Rules (Apply to ALL Stages)

1. **Do NOT add client-side answer checking in exercise renderers.** The agent judges correctness.
2. **Do NOT use `getDisplayMedia()`.** We capture our own canvas frames.
3. **Do NOT create proxy meshes, bounding boxes, or object inventories.** Gemini sees pixels.
4. **Do NOT try to make Gemini return pixel coordinates.** Use the 5 coarse `position_hint` regions.
5. **Do NOT upgrade Three.js or Spark beyond pinned versions** (three 0.180.0, spark 2.1.0).
6. **Do NOT add any database other than Redis.**
7. **Do NOT use localStorage or sessionStorage.** Use Zustand for UI state, Redis for persistence.
8. **LinkUp is the ONLY source of authentic sentences.** Do not use any other external API for example sentences. Gemini provides a generated `example_sentence` as immediate fallback; LinkUp provides `authentic_sentence` asynchronously. Both are shown on the card if available.
9. **Do NOT create a separate World Tutor ADK agent.** Gemini Live IS the tutor (runs client-side via WebSocket).
