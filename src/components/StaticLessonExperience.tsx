"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import LessonHUD from "@/components/LessonHUD";
import MultipleChoice from "@/components/exercises/MultipleChoice";
import WordBank from "@/components/exercises/WordBank";
import Listening from "@/components/exercises/Listening";
import SpeakIt from "@/components/exercises/SpeakIt";
import LessonComplete from "@/components/exercises/LessonComplete";
import {
  buildLessonComplete,
  hasStaticExercises,
  judgeExercise,
} from "@/lib/static-lesson";
import { useLessonStore } from "@/lib/store";
import {
  ExercisePayload,
  LessonComplete as LessonCompletePayload,
  Unit,
} from "@/lib/types";
import styles from "@/app/lesson/[unitId]/page.module.css";

function getWordId(exercise: ExercisePayload | null): string | null {
  if (!exercise) return null;
  if ("word_id" in exercise && exercise.word_id) return exercise.word_id;
  return null;
}

function bootstrapStaticLesson(unit: Unit, exercises: ExercisePayload[]) {
  const store = useLessonStore.getState();
  store.reset();
  store.setExercise(exercises[0]);
  store.setFeedback("idle");
  store.advanceIndex();
}

interface StaticLessonExperienceProps {
  unit: Unit;
}

export default function StaticLessonExperience({
  unit,
}: StaticLessonExperienceProps) {
  const router = useRouter();
  const exercises = unit.exercises!;

  const bootstrappedUnitRef = useRef<string | null>(null);
  if (bootstrappedUnitRef.current !== unit.unit_id) {
    bootstrapStaticLesson(unit, exercises);
    bootstrappedUnitRef.current = unit.unit_id;
  }

  const stepRef = useRef(0);
  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);
  const advancingRef = useRef(false);

  useEffect(() => {
    stepRef.current = 0;
    correctCountRef.current = 0;
    wrongCountRef.current = 0;
    advancingRef.current = false;
    bootstrapStaticLesson(unit, exercises);
    bootstrappedUnitRef.current = unit.unit_id;
  }, [unit.unit_id, exercises, unit]);

  const currentExercise = useLessonStore((s) => s.currentExercise);
  const feedbackState = useLessonStore((s) => s.feedbackState);
  const exerciseIndex = useLessonStore((s) => s.exerciseIndex);
  const totalExercises = useLessonStore((s) => s.totalExercises);
  const setFeedback = useLessonStore((s) => s.setFeedback);
  const addXp = useLessonStore((s) => s.addXp);
  const loseHeart = useLessonStore((s) => s.loseHeart);
  const addMissed = useLessonStore((s) => s.addMissed);

  const showExercise = useCallback(
    (index: number) => {
      const { setExercise, advanceIndex, setFeedback } =
        useLessonStore.getState();
      setExercise(exercises[index]);
      setFeedback("idle");
      advanceIndex();
      stepRef.current = index;
    },
    [exercises]
  );

  const advanceAfterFeedback = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    setTimeout(() => {
      advancingRef.current = false;
      const { setExercise, setFeedback } = useLessonStore.getState();
      setFeedback("idle");

      const next = stepRef.current + 1;
      if (next < exercises.length) {
        showExercise(next);
        return;
      }

      const missed = useLessonStore.getState().missedWordIds;
      setExercise(
        buildLessonComplete(
          unit,
          missed,
          correctCountRef.current,
          wrongCountRef.current
        )
      );
    }, 1500);
  }, [exercises.length, showExercise, unit]);

  const handleSubmit = useCallback(
    (_exerciseId: string, response: unknown) => {
      const exercise = useLessonStore.getState().currentExercise;
      if (!exercise || exercise.type === "lesson.complete") return;

      const payload =
        typeof response === "object" && response !== null
          ? (response as Record<string, unknown>)
          : { response };

      const correct = judgeExercise(exercise, payload);
      if (correct) {
        correctCountRef.current += 1;
        setFeedback("correct");
        addXp(10);
      } else {
        wrongCountRef.current += 1;
        setFeedback("wrong");
        loseHeart();
        const wordId = getWordId(exercise);
        if (wordId) addMissed(wordId);
      }

      advanceAfterFeedback();
    },
    [addMissed, addXp, advanceAfterFeedback, loseHeart, setFeedback]
  );

  useEffect(() => {
    if (!unit || exerciseIndex < totalExercises - 2) return;
    const missed = useLessonStore.getState().missedWordIds.join(",");
    const query = missed ? `?missed=${missed}` : "";
    router.prefetch(`/world/${unit.world_id}${query}`);
    fetch(`/worlds/${unit.world_id}.spz`).catch(() => {});
  }, [exerciseIndex, totalExercises, unit, router]);

  if (!currentExercise) {
    return null;
  }

  if (currentExercise.type === "lesson.complete") {
    return (
      <LessonComplete
        exercise={currentExercise as LessonCompletePayload}
        fallbackWorldId={unit.world_id}
      />
    );
  }

  return (
    <div className={styles.shell}>
      <LessonHUD />

      {currentExercise.type === "exercise.multiple_choice" && (
        <MultipleChoice
          exercise={currentExercise}
          onSubmit={handleSubmit}
          feedbackState={feedbackState}
        />
      )}
      {currentExercise.type === "exercise.word_bank" && (
        <WordBank
          exercise={currentExercise}
          onSubmit={handleSubmit}
          feedbackState={feedbackState}
        />
      )}
      {currentExercise.type === "exercise.listening" && (
        <Listening
          exercise={currentExercise}
          onSubmit={handleSubmit}
          feedbackState={feedbackState}
        />
      )}
      {currentExercise.type === "exercise.speak_it" && (
        <SpeakIt
          exercise={currentExercise}
          onSubmit={handleSubmit}
          feedbackState={feedbackState}
        />
      )}
    </div>
  );
}
