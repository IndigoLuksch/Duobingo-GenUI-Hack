import { CourseId, getCourse } from "./courses";
import { getCustomUnits } from "./custom-units";
import { Unit } from "./types";

/** Local splat demos keyed by world route id (e.g. /world/wasabi). */
const DEMO_SPLAT_WORLDS: Record<
  string,
  { unitId: string; splatWorldId: string; courseId: CourseId }
> = {
  wasabi: { unitId: "cafe_1", splatWorldId: "wasabi", courseId: "de" },
};

export function getWorldCourseId(
  courseId: CourseId,
  worldId: string
): CourseId {
  return DEMO_SPLAT_WORLDS[worldId]?.courseId ?? courseId;
}

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
  const demo = DEMO_SPLAT_WORLDS[worldId];
  if (demo) {
    const base = getAllUnits(demo.courseId).find((u) => u.unit_id === demo.unitId);
    if (base) {
      return {
        ...base,
        world_id: worldId,
        splat_world_id: demo.splatWorldId,
      };
    }
  }
  return getAllUnits(courseId).find((u) => u.world_id === worldId) ?? null;
}

export function getSplatWorldId(unit: Unit): string {
  return unit.splat_world_id ?? unit.world_id;
}
