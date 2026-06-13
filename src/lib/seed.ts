import redis, { setProfile, setWordStrength } from "./redis";
import { defaultCourseProgress } from "./courses";
import { seedAllPrebuiltWorlds } from "./prebuilt-worlds-server";
import { LearnerProfile, WordStrength } from "./types";

const uid = "demo";

const profile: LearnerProfile = {
  uid,
  xp: 340,
  streak: 6,
  hearts: 3,
  last_active: new Date().toISOString(),
  unit_progress: defaultCourseProgress().fr,
  course_progress: defaultCourseProgress(),
};

function wordStrength(
  word_id: string,
  strength: number,
  seen: number = 5
): WordStrength {
  const correct = Math.round(strength * seen);
  const wrong = seen - correct;
  return {
    word_id,
    strength,
    due_ts: Date.now(),
    seen,
    correct,
    wrong,
  };
}

const bakeryWords: WordStrength[] = [
  wordStrength("baguette", 0.25),
  wordStrength("pain", 0.3),
  wordStrength("gateau", 0.8),
  wordStrength("farine", 0.65),
  wordStrength("four", 0.6),
  wordStrength("caisse", 0.7),
  wordStrength("panier", 0.55),
  wordStrength("boulanger", 0.5),
  wordStrength("tablier", 0.75),
  wordStrength("comptoir", 0.85),
];

async function seed() {
  await setProfile(uid, profile);
  console.log("Seeded profile:", profile);

  for (const ws of bakeryWords) {
    await setWordStrength(uid, ws);
    console.log(`Seeded word strength: ${ws.word_id} (strength: ${ws.strength})`);
  }

  await seedAllPrebuiltWorlds(uid);
  console.log("Seeded prebuilt Kings Cross worlds (station, Pret, bakery)");

  await redis.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
