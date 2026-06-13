/**
 * Generate lessons offline and append them to data/courses/*.json for deploy.
 *
 * Usage:
 *   npx tsx scripts/build-prebuilt-lessons.ts de airport park restaurant hotel
 *   npx tsx scripts/build-prebuilt-lessons.ts de --defaults
 *   npx tsx scripts/build-prebuilt-lessons.ts fr airport
 *
 * Requires: GEMINI_API_KEY and/or LINKUP_API_KEY in .env.local
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CourseId, COURSE_IDS, isCourseId } from "../src/lib/courses";
import { generateLesson } from "../src/lib/lesson-generation";
import { Course, Unit } from "../src/lib/types";

const envPath = resolve(process.cwd(), ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  /* optional */
}

const DEFAULT_TOPICS: Record<CourseId, string[]> = {
  fr: ["airport", "park", "restaurant", "pharmacy"],
  de: ["airport", "park", "restaurant", "pharmacy"],
  it: ["airport", "park", "restaurant", "pharmacy"],
};

const COURSE_FILES: Record<CourseId, string> = {
  fr: "data/courses/fr.json",
  de: "data/courses/de.json",
  it: "data/courses/it.json",
};

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(der|die|das|le|la|l'|il|lo|la|i|gli|le|un|une|ein|eine)\s+/i, "")
    .replace(/[^a-z0-9äöüßàèéìòù]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 36);
}

function topicSlug(topic: string): string {
  return slugify(topic) || "lesson";
}

function allocateUnitId(
  topic: string,
  existingIds: Set<string>
): string {
  const base = topicSlug(topic);
  let n = 1;
  while (true) {
    const id = `${base}_${n}`;
    if (!existingIds.has(id)) return id;
    n++;
  }
}

function toStaticUnit(
  topic: string,
  unit: Unit,
  courseId: CourseId,
  existingIds: Set<string>
): Unit {
  const unitId = allocateUnitId(topic, existingIds);
  const slug = unitId.replace(/_\d+$/, "");

  const { custom: _custom, splat_world_id: _splat, ...rest } = unit;
  return {
    ...rest,
    unit_id: unitId,
    world_id: `${slug}_${courseId}`,
  };
}

function loadCourse(courseId: CourseId): Course {
  const path = resolve(process.cwd(), COURSE_FILES[courseId]);
  return JSON.parse(readFileSync(path, "utf8")) as Course;
}

function saveCourse(courseId: CourseId, course: Course) {
  const path = resolve(process.cwd(), COURSE_FILES[courseId]);
  writeFileSync(path, `${JSON.stringify(course, null, 2)}\n`);
}

function existingTopicSlugs(course: Course): Set<string> {
  const slugs = new Set<string>();
  for (const unit of course.units) {
    const base = unit.unit_id.replace(/_\d+$/, "");
    slugs.add(base);
  }
  return slugs;
}

async function buildOne(
  courseId: CourseId,
  topic: string,
  course: Course
): Promise<Unit | null> {
  const slug = topicSlug(topic);
  if (existingTopicSlugs(course).has(slug)) {
    console.log(`  skip "${topic}" — already have unit_id prefix ${slug}_*`);
    return null;
  }

  console.log(`  generating "${topic}"…`);
  const generated = await generateLesson(topic, courseId);
  if (!generated) {
    console.error(`  failed to generate "${topic}"`);
    return null;
  }

  const existingIds = new Set(course.units.map((u) => u.unit_id));
  const unit = toStaticUnit(topic, generated, courseId, existingIds);
  course.units.push(unit);
  existingIds.add(unit.unit_id);
  existingTopicSlugs(course).add(slug);

  console.log(`  added ${unit.unit_id}: ${unit.title} (${unit.vocab.length} words)`);
  return unit;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: npx tsx scripts/build-prebuilt-lessons.ts <courseId> [topic...|--defaults]"
    );
    process.exit(1);
  }

  const courseArg = args[0];
  if (!isCourseId(courseArg)) {
    console.error(`Unknown course "${courseArg}". Use: ${COURSE_IDS.join(", ")}`);
    process.exit(1);
  }
  const courseId = courseArg;

  let topics: string[];
  if (args.length === 1 || args[1] === "--defaults") {
    topics = DEFAULT_TOPICS[courseId];
  } else {
    topics = args.slice(1).filter((t) => t !== "--defaults");
  }

  if (!process.env.GEMINI_API_KEY && !process.env.LINKUP_API_KEY) {
    console.error("Set GEMINI_API_KEY or LINKUP_API_KEY in .env.local");
    process.exit(1);
  }

  const course = loadCourse(courseId);
  console.log(`\n=== ${course.title} (${courseId}) — ${topics.length} topic(s) ===\n`);

  let added = 0;
  for (const topic of topics) {
    const unit = await buildOne(courseId, topic, course);
    if (unit) added++;
  }

  if (added > 0) {
    saveCourse(courseId, course);
    console.log(`\nWrote ${added} unit(s) to ${COURSE_FILES[courseId]}`);
  } else {
    console.log("\nNo new units added.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
