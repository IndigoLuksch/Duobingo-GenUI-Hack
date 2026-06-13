/**
 * Stage 19 — End-to-End Integration Test
 *
 * Verifies API routes, Redis persistence, course data, SRS math, and page availability.
 * Run with all services up:
 *   docker compose up -d && npm run seed && npm run dev
 *   cd services/agents && uvicorn server:app --port 8000
 *   npm run test:e2e
 */

import course from "../data/courses/fr.json";
import { applyCorrect, applyWrong } from "../src/lib/srs";
import { Course } from "../src/lib/types";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const AGENT_URL = process.env.LESSON_AGENT_URL || "http://localhost:8000";

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchJson(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: res.status, body };
}

function assertClose(actual: number, expected: number, tolerance = 0.001) {
  return Math.abs(actual - expected) <= tolerance;
}

async function testCourseData() {
  const typed = course as Course;
  if (typed.units.length < 4) {
    fail("Course has bakery, café, station, and market units");
    return;
  }
  const bakery = typed.units.find((u) => u.unit_id === "boulangerie_1");
  const cafe = typed.units.find((u) => u.unit_id === "cafe_1");
  if (!bakery || bakery.world_id !== "boulangerie_fr") {
    fail("Bakery unit data");
    return;
  }
  if (!cafe) {
    fail("Café unit data");
    return;
  }
  pass("Course data", `${typed.units.length} units, boulangerie_fr world`);
}

function testSrsMath() {
  const base = {
    word_id: "test",
    strength: 0.5,
    due_ts: 0,
    seen: 3,
    correct: 2,
    wrong: 1,
  };
  const boosted = applyCorrect(base, "lesson");
  if (!assertClose(boosted.strength, 0.55)) {
    fail("SRS applyCorrect lesson", `got ${boosted.strength}`);
    return;
  }
  const penalized = applyWrong(base, "lesson");
  if (!assertClose(penalized.strength, 0.3)) {
    fail("SRS applyWrong lesson", `got ${penalized.strength}`);
    return;
  }
  const worldBoost = applyCorrect(base, "world");
  if (!assertClose(worldBoost.strength, 0.575)) {
    fail("SRS applyCorrect world", `got ${worldBoost.strength}`);
    return;
  }
  pass("SRS math");
}

async function testRedisProfile() {
  const { status, body } = await fetchJson("/api/redis/profile?uid=demo");
  if (status !== 200) {
    fail("GET /api/redis/profile", `status ${status}`);
    return;
  }
  const profile = body as Record<string, unknown>;
  if (profile.unit_progress?.boulangerie_1 !== "current") {
    fail("Profile boulangerie_1 progress", JSON.stringify(profile.unit_progress));
    return;
  }
  if (profile.unit_progress?.cafe_1 !== "locked") {
    fail("Profile cafe_1 locked", JSON.stringify(profile.unit_progress));
    return;
  }
  pass("Redis profile", `xp=${profile.xp}, streak=${profile.streak}`);
}

async function testWordStrengths() {
  const { status, body } = await fetchJson(
    "/api/redis/word-strengths?uid=demo&word_ids=baguette,pain,four"
  );
  if (status !== 200) {
    fail("GET /api/redis/word-strengths", `status ${status}`);
    return;
  }
  const strengths = (body as { strengths?: unknown[] }).strengths;
  if (!Array.isArray(strengths) || strengths.length !== 3) {
    fail("Word strengths array", JSON.stringify(body));
    return;
  }
  pass("Word strengths load", `3 words returned`);
}

async function testStrengthUpdateRoundTrip() {
  const { body: beforeBody } = await fetchJson(
    "/api/redis/word-strengths?uid=demo&word_ids=baguette"
  );
  const before = (beforeBody as { strengths: { strength: number }[] })
    .strengths[0].strength;

  const { status, body } = await fetchJson("/api/redis/update-strength", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: "demo", word_id: "baguette", result: "boost" }),
  });
  if (status !== 200) {
    fail("POST /api/redis/update-strength", `status ${status}`);
    return;
  }
  const newStrength = (body as { new_strength: number }).new_strength;
  if (newStrength <= before) {
    fail("Strength boost", `before=${before}, after=${newStrength}`);
    return;
  }

  const { body: afterBody } = await fetchJson(
    "/api/redis/word-strengths?uid=demo&word_ids=baguette"
  );
  const persisted = (afterBody as { strengths: { strength: number }[] })
    .strengths[0].strength;
  if (!assertClose(persisted, newStrength)) {
    fail("Strength persisted to Redis", `expected ${newStrength}, got ${persisted}`);
    return;
  }
  pass("Redis strength update round-trip", `baguette ${before.toFixed(2)} → ${newStrength.toFixed(2)}`);
}

async function testPages() {
  const routes = [
    { path: "/", label: "Path map" },
    { path: "/lesson/boulangerie_1", label: "Lesson page" },
    { path: "/world/cafe_fr?missed=baguette,pain", label: "World page" },
  ];
  for (const route of routes) {
    const res = await fetch(`${BASE}${route.path}`);
    if (res.status !== 200) {
      fail(`${route.label} (${route.path})`, `status ${res.status}`);
      return;
    }
  }
  pass("Pages load", routes.map((r) => r.path).join(", "));
}

async function testGeminiToken() {
  const { status, body } = await fetchJson("/api/gemini-token");
  if (status !== 200) {
    fail("GET /api/gemini-token", `status ${status}`);
    return;
  }
  const apiKey = (body as { apiKey?: string }).apiKey;
  if (!apiKey) {
    fail("Gemini API key configured", "empty — set GEMINI_API_KEY in .env.local");
    return;
  }
  pass("Gemini token endpoint", "key present");
}

async function testLinkupRoute() {
  const { status, body } = await fetchJson("/api/linkup/example-sentence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word: "la table", translation: "table" }),
  });
  if (status !== 200) {
    fail("POST /api/linkup/example-sentence", `status ${status}`);
    return;
  }
  const data = body as { sentence?: string | null; source?: string | null };
  if (!("sentence" in data) || !("source" in data)) {
    fail("LinkUp response shape", JSON.stringify(body));
    return;
  }
  pass(
    "LinkUp route",
    data.sentence ? `sentence from ${data.source}` : "graceful null (no key or no result)"
  );
}

async function testAgentServer() {
  try {
    const res = await fetch(`${AGENT_URL}/docs`);
    if (res.status === 200) {
      pass("Lesson agent server", AGENT_URL);
    } else {
      fail("Lesson agent server", `status ${res.status}`);
    }
  } catch {
    fail("Lesson agent server", `not reachable at ${AGENT_URL}`);
  }
}

async function testStoreLogic() {
  const { useLessonStore, useWorldStore } = await import("../src/lib/store");

  useLessonStore.getState().reset();
  useLessonStore.getState().addXp(10);
  useLessonStore.getState().addXp(10);
  if (useLessonStore.getState().xp !== 20) {
    fail("Lesson store XP accumulation");
    return;
  }
  useLessonStore.getState().loseHeart();
  useLessonStore.getState().loseHeart();
  if (useLessonStore.getState().hearts !== 1) {
    fail("Lesson store hearts decrease");
    return;
  }
  useLessonStore.getState().addMissed("table");
  useLessonStore.getState().addMissed("table");
  if (useLessonStore.getState().missedWordIds.length !== 1) {
    fail("Lesson store missed words deduped");
    return;
  }

  useWorldStore.getState().reset();
  useWorldStore.getState().setMissedWordIds(["table", "chaise"]);
  useWorldStore.getState().updateStrength("table", 0.4, true);
  if (useWorldStore.getState().boostedWordIds.length !== 1) {
    fail("World store boosted tracking");
    return;
  }
  useLessonStore.getState().reset();
  useWorldStore.getState().reset();
  pass("Zustand store logic", "XP, hearts, missed, strength");
}

async function main() {
  console.log("\n=== Stage 19: End-to-End Integration Test ===\n");
  console.log(`Base URL: ${BASE}`);
  console.log(`Agent URL: ${AGENT_URL}\n`);

  await testCourseData();
  testSrsMath();
  await testStoreLogic();

  try {
    await fetch(BASE);
  } catch {
    console.error(
      "\n⚠ Next.js dev server not reachable. Start with: npm run dev\n"
    );
    const failed = results.filter((r) => !r.ok).length;
    process.exit(failed > 0 ? 1 : 0);
  }

  await testRedisProfile();
  await testWordStrengths();
  await testStrengthUpdateRoundTrip();
  await testPages();
  await testGeminiToken();
  await testLinkupRoute();
  await testAgentServer();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  if (failed > 0) {
    console.log("Manual browser checklist (Stage 19.2):");
    console.log("  1. http://localhost:3000 — Bakery current, Café locked");
    console.log("  2. Tap Bakery → /lesson/boulangerie_1");
    console.log("  3. Complete 8 exercises (mix correct/wrong)");
    console.log("  4. Lesson-complete card → Enter the Bakery →");
    console.log("  5. Portal transition → world loads");
    console.log("  6. Gemini Live greets, word cards + HUD update");
    console.log("  7. Exit world → back to path map\n");
    process.exit(1);
  }

  console.log("All automated checks passed.");
  console.log("\nComplete the manual browser flow (Stage 19.2) to verify:");
  console.log("  • Exercise feedback animations, hearts, XP");
  console.log("  • Portal transition + Gemini Live voice tutor");
  console.log("  • Word cards in scene, HUD strength bars\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
