import redis, { setProfile, setWordStrength } from "./redis";
import { LearnerProfile, WordStrength } from "./types";

const uid = "demo";

const profile: LearnerProfile = {
  uid,
  xp: 340,
  streak: 6,
  hearts: 3,
  last_active: new Date().toISOString(),
  unit_progress: {
    kitchen_1: "current",
    cafe_1: "locked",
  },
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

const kitchenWords: WordStrength[] = [
  wordStrength("table", 0.25),
  wordStrength("chaise", 0.30),
  wordStrength("four", 0.80),
  wordStrength("refrigerateur", 0.65),
  wordStrength("evier", 0.60),
  wordStrength("cuisiniere", 0.70),
  wordStrength("poele", 0.55),
  wordStrength("marmite", 0.50),
  wordStrength("etagere", 0.75),
  wordStrength("fenetre", 0.85),
];

async function seed() {
  await setProfile(uid, profile);
  console.log("Seeded profile:", profile);

  for (const ws of kitchenWords) {
    await setWordStrength(uid, ws);
    console.log(`Seeded word strength: ${ws.word_id} (strength: ${ws.strength})`);
  }

  await redis.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
