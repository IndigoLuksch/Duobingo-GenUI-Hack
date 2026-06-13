export function getLessonPrepStepId(params: {
  courseReady: boolean;
  unit: unknown;
  strengthsReady?: boolean;
  agentAvailable?: boolean;
  lessonStartSent?: boolean;
  hasExercise?: boolean;
}): string {
  if (!params.courseReady || !params.unit) return "course";
  if (params.strengthsReady === false) return "progress";
  if (params.agentAvailable === false) return "connect";
  if (!params.lessonStartSent) return "plan";
  if (!params.hasExercise) return "exercise";
  return "exercise";
}
