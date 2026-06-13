import Redis from "ioredis";
import { LearnerProfile, MemoryPlaceRecord, WordStrength } from "./types";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
export default redis;

// Key patterns:
// learner:{uid}:profile         → JSON string of LearnerProfile
// learner:{uid}:word:{word_id}  → JSON string of WordStrength
// memory_place:{uid}:{place_id} → JSON string of MemoryPlaceRecord

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

export async function getMemoryPlace(
  uid: string,
  placeId: string
): Promise<MemoryPlaceRecord | null> {
  const data = await redis.get(`memory_place:${uid}:${placeId}`);
  return data ? (JSON.parse(data) as MemoryPlaceRecord) : null;
}

export async function setMemoryPlace(
  uid: string,
  record: MemoryPlaceRecord
): Promise<void> {
  await redis.set(
    `memory_place:${uid}:${record.place_id}`,
    JSON.stringify(record)
  );
}
