import { CourseId } from "./courses";
import { Unit } from "./types";

const STORAGE_KEY = "duobingo_custom_units";

type StoredCustomUnits = Partial<Record<CourseId, Unit[]>>;

function readAll(): StoredCustomUnits {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredCustomUnits;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: StoredCustomUnits): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getCustomUnits(courseId: CourseId): Unit[] {
  return readAll()[courseId] ?? [];
}

export function saveCustomUnit(courseId: CourseId, unit: Unit): void {
  const all = readAll();
  const existing = all[courseId] ?? [];
  all[courseId] = [...existing.filter((u) => u.unit_id !== unit.unit_id), unit];
  writeAll(all);
}

export function findCustomUnit(
  courseId: CourseId,
  unitId: string
): Unit | null {
  return getCustomUnits(courseId).find((u) => u.unit_id === unitId) ?? null;
}

export function findCustomUnitByWorldId(
  courseId: CourseId,
  worldId: string
): Unit | null {
  return getCustomUnits(courseId).find((u) => u.world_id === worldId) ?? null;
}
