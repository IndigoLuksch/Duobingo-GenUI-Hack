export const pendingExerciseRespondRef: {
  current: ((response: Record<string, unknown>) => void) | null;
} = { current: null };

export const pendingJudgmentRef: {
  current: { wordId: string | null } | null;
} = { current: null };
