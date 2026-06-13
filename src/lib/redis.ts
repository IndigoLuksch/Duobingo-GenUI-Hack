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
