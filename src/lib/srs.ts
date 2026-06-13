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
