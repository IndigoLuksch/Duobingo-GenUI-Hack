import { CourseId, getCourse } from "./courses";
import { getCustomUnits } from "./custom-units";
import { Unit } from "./types";

export function getAllUnits(courseId: CourseId): Unit[] {
  return [...getCourse(courseId).units, ...getCustomUnits(courseId)];
}

export function findUnitById(
  courseId: CourseId,
  unitId: string
): Unit | null {
  return getAllUnits(courseId).find((u) => u.unit_id === unitId) ?? null;
}

export function findUnitByWorldId(
  courseId: CourseId,
  worldId: string
): Unit | null {
  return getAllUnits(courseId).find((u) => u.world_id === worldId) ?? null;
}

export function getSplatWorldId(unit: Unit): string {
  return unit.splat_world_id ?? unit.world_id;
}
