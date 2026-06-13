import { create } from "zustand";
import { ExercisePayload, WorldCardData } from "./types";

interface LessonStore {
  exerciseIndex: number;
  totalExercises: number;
  hearts: number;
  xp: number;
  missedWordIds: string[];
  currentExercise: ExercisePayload | null;
  feedbackState: "idle" | "correct" | "wrong";
  setExercise: (e: ExercisePayload) => void;
  addMissed: (wordId: string) => void;
  loseHeart: () => void;
  addXp: (n: number) => void;
  setFeedback: (f: "idle" | "correct" | "wrong") => void;
  advanceIndex: () => void;
  reset: () => void;
}

const initialLessonState = {
  exerciseIndex: 0,
  totalExercises: 8,
  hearts: 3,
  xp: 0,
  missedWordIds: [] as string[],
  currentExercise: null as ExercisePayload | null,
  feedbackState: "idle" as const,
};

export const useLessonStore = create<LessonStore>((set) => ({
  ...initialLessonState,
  setExercise: (e) => set({ currentExercise: e }),
  addMissed: (wordId) =>
    set((s) => ({
      missedWordIds: [...new Set([...s.missedWordIds, wordId])],
    })),
  loseHeart: () => set((s) => ({ hearts: Math.max(0, s.hearts - 1) })),
  addXp: (n) => set((s) => ({ xp: s.xp + n })),
  setFeedback: (f) => set({ feedbackState: f }),
  advanceIndex: () => set((s) => ({ exerciseIndex: s.exerciseIndex + 1 })),
  reset: () => set(initialLessonState),
}));

interface WorldStore {
  cards: WorldCardData[];
  strengthUpdates: Record<string, number>;
  boostedWordIds: string[];
  missedWordIds: string[];
  addCard: (card: WorldCardData) => void;
  updateCard: (id: string, updates: Partial<WorldCardData>) => void;
  removeCard: (id: string) => void;
  updateStrength: (
    wordId: string,
    strength: number,
    boosted?: boolean
  ) => void;
  setMissedWordIds: (ids: string[]) => void;
  reset: () => void;
}

const initialWorldState = {
  cards: [] as WorldCardData[],
  strengthUpdates: {} as Record<string, number>,
  boostedWordIds: [] as string[],
  missedWordIds: [] as string[],
};

export const useWorldStore = create<WorldStore>((set) => ({
  ...initialWorldState,
  addCard: (card) =>
    set((s) => ({
      cards: [...s.cards.slice(-1), card],
    })),
  updateCard: (id, updates) =>
    set((s) => ({
      cards: s.cards.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  removeCard: (id) =>
    set((s) => ({
      cards: s.cards.filter((c) => c.id !== id),
    })),
  updateStrength: (wordId, strength, boosted = true) =>
    set((s) => ({
      strengthUpdates: { ...s.strengthUpdates, [wordId]: strength },
      boostedWordIds:
        boosted && !s.boostedWordIds.includes(wordId)
          ? [...s.boostedWordIds, wordId]
          : s.boostedWordIds,
    })),
  setMissedWordIds: (ids) => set({ missedWordIds: ids }),
  reset: () => set(initialWorldState),
}));
