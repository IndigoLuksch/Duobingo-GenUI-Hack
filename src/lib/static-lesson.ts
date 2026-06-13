import { CourseId, LANGUAGE_LABELS } from "./courses";
import {
  ExercisePayload,
  LessonComplete,
  Unit,
} from "./types";

export function hasStaticExercises(unit: Unit): boolean {
  return (unit.exercises?.length ?? 0) >= 8;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, "")
    .trim();
}

function characterOverlap(spoken: string, target: string): number {
  const a = normalizeText(spoken);
  const b = normalizeText(target);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aChars = [...a.replace(/\s/g, "")];
  const bChars = [...b.replace(/\s/g, "")];
  let matches = 0;
  const used = new Set<number>();

  for (const ch of aChars) {
    const idx = bChars.findIndex((c, i) => c === ch && !used.has(i));
    if (idx !== -1) {
      matches++;
      used.add(idx);
    }
  }

  return matches / Math.max(bChars.length, 1);
}

export function judgeExercise(
  exercise: ExercisePayload,
  response: Record<string, unknown>
): boolean {
  if (exercise.type === "exercise.multiple_choice") {
    return response.selected_idx === exercise.answer_idx;
  }

  if (exercise.type === "exercise.listening") {
    return response.selected_idx === exercise.answer_idx;
  }

  if (exercise.type === "exercise.word_bank") {
    const selected = (response.selected_tiles as string[]) ?? [];
    return (
      selected.length === exercise.answer.length &&
      selected.every(
        (tile, i) => tile.toLowerCase() === exercise.answer[i].toLowerCase()
      )
    );
  }

  if (exercise.type === "exercise.speak_it") {
    const spoken = String(response.spoken ?? "");
    return characterOverlap(spoken, exercise.target_text) >= 0.7;
  }

  return false;
}

export function computeLessonXp(correctCount: number, wrongCount: number): number {
  let xp = correctCount * 5;
  if (wrongCount <= 1) xp += 10;
  else if (wrongCount <= 2) xp += 5;
  return xp;
}

export function buildLessonComplete(
  unit: Unit,
  missedWordIds: string[],
  correctCount: number,
  wrongCount: number
): LessonComplete {
  return {
    type: "lesson.complete",
    xp_gained: computeLessonXp(correctCount, wrongCount),
    missed_word_ids: missedWordIds,
    world_id: unit.world_id,
    unit_title: unit.title,
  };
}

export function getStaticFeedback(
  courseId: CourseId,
  correct: boolean
): string {
  const labels = LANGUAGE_LABELS[courseId];
  if (correct) {
    return labels.feedbackCorrect[0];
  }
  return labels.feedbackWrong[0];
}
