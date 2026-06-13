import deCourse from "../../data/courses/de.json";
import frCourse from "../../data/courses/fr.json";
import itCourse from "../../data/courses/it.json";
import { Course, LearnerProfile } from "./types";

export type CourseId = "fr" | "de" | "it";

export const COURSE_IDS: CourseId[] = ["fr", "de", "it"];

export const COURSES: Record<CourseId, Course> = {
  fr: frCourse as Course,
  de: deCourse as Course,
  it: itCourse as Course,
};

export const COURSE_FLAGS: Record<CourseId, string> = {
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
};

export const COURSE_STORAGE_KEY = "duobingo_course";

export const LANGUAGE_LABELS: Record<
  CourseId,
  {
    name: string;
    tutorRole: string;
    sessionGreeting: string;
    lessonCompleteNote: string;
    feedbackCorrect: string[];
    feedbackWrong: string[];
  }
> = {
  fr: {
    name: "French",
    tutorRole: "French language tutor",
    sessionGreeting: "Greet them warmly in French",
    lessonCompleteNote: "briefly in French, then in English",
    feedbackCorrect: ["Bien joué", "Exactement", "Parfait", "Bravo"],
    feedbackWrong: ["Presque"],
  },
  de: {
    name: "German",
    tutorRole: "German language tutor",
    sessionGreeting: "Greet them warmly in German",
    lessonCompleteNote: "briefly in German, then in English",
    feedbackCorrect: ["Gut gemacht", "Genau", "Perfekt"],
    feedbackWrong: ["Fast"],
  },
  it: {
    name: "Italian",
    tutorRole: "Italian language tutor",
    sessionGreeting: "Greet them warmly in Italian",
    lessonCompleteNote: "briefly in Italian, then in English",
    feedbackCorrect: ["Bravo", "Esatto", "Perfetto", "Ben fatto"],
    feedbackWrong: ["Quasi"],
  },
};

const UNIT_IDS = ["boulangerie_1", "cafe_1", "gare_1", "marche_1"] as const;

export function defaultUnitProgress(): Record<
  string,
  "locked" | "current" | "complete"
> {
  return {
    boulangerie_1: "current",
    cafe_1: "locked",
    gare_1: "locked",
    marche_1: "locked",
  };
}

export function defaultCourseProgress(): Record<
  CourseId,
  Record<string, "locked" | "current" | "complete">
> {
  return {
    fr: defaultUnitProgress(),
    de: defaultUnitProgress(),
    it: defaultUnitProgress(),
  };
}

export function getCourse(courseId: CourseId): Course {
  return COURSES[courseId];
}

export function isCourseId(value: string): value is CourseId {
  return COURSE_IDS.includes(value as CourseId);
}

export function readStoredCourseId(): CourseId {
  if (typeof window === "undefined") return "fr";
  try {
    const stored = localStorage.getItem(COURSE_STORAGE_KEY);
    if (stored && isCourseId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "fr";
}

export function writeStoredCourseId(courseId: CourseId): void {
  try {
    localStorage.setItem(COURSE_STORAGE_KEY, courseId);
  } catch {
    /* ignore */
  }
}

export function mergeUnitProgress(
  courseId: CourseId,
  profile: LearnerProfile
): Record<string, "locked" | "current" | "complete"> {
  const course = getCourse(courseId);
  const defaults = defaultUnitProgress();
  const merged = { ...defaults };

  const fromCourse = profile.course_progress?.[courseId];
  const fromLegacy = profile.unit_progress;

  for (const unit of course.units) {
    const status = fromCourse?.[unit.unit_id] ?? fromLegacy?.[unit.unit_id];
    if (status) {
      merged[unit.unit_id] = status;
    }
  }

  const hasCurrent = Object.values(merged).some((s) => s === "current");
  if (!hasCurrent && course.units.length > 0) {
    merged[course.units[0].unit_id] = "current";
  }

  return merged;
}
