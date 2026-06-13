"use client";

import { use } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CopilotKit,
  useCopilotChatInternal,
  useCopilotReadable,
} from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import LessonHUD from "@/components/LessonHUD";
import LessonAgentBridge from "@/components/LessonAgentBridge";
import MultipleChoice from "@/components/exercises/MultipleChoice";
import WordBank from "@/components/exercises/WordBank";
import Listening from "@/components/exercises/Listening";
import SpeakIt from "@/components/exercises/SpeakIt";
import LessonComplete from "@/components/exercises/LessonComplete";
import course from "../../../../data/courses/fr.json";
import {
  lessonStartSent,
  pendingExerciseRespondRef,
  pendingJudgmentRef,
} from "@/lib/lessonAgentBridge";
import { useLessonStore } from "@/lib/store";
import {
  Course,
  ExercisePayload,
  LessonComplete as LessonCompletePayload,
  WordStrength,
} from "@/lib/types";

const typedCourse = course as Course;

function getWordId(exercise: ExercisePayload | null): string | null {
  if (!exercise) return null;
  if ("word_id" in exercise && exercise.word_id) return exercise.word_id;
  return null;
}

function LessonExperience({
  unitId,
  agentError,
}: {
  unitId: string;
  agentError: boolean;
}) {
  const unit = useMemo(
    () => typedCourse.units.find((u) => u.unit_id === unitId) ?? null,
    [unitId]
  );

  const [wordStrengths, setWordStrengths] = useState<WordStrength[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastAssistantMessageRef = useRef<string | null>(null);
  const prevUnitIdRef = useRef<string | null>(null);

  const currentExercise = useLessonStore((s) => s.currentExercise);
  const feedbackState = useLessonStore((s) => s.feedbackState);
  const exerciseIndex = useLessonStore((s) => s.exerciseIndex);
  const totalExercises = useLessonStore((s) => s.totalExercises);
  const setFeedback = useLessonStore((s) => s.setFeedback);
  const addXp = useLessonStore((s) => s.addXp);
  const loseHeart = useLessonStore((s) => s.loseHeart);
  const addMissed = useLessonStore((s) => s.addMissed);

  const { appendMessage, messages } = useCopilotChatInternal();

  useCopilotReadable({
    description:
      "Lesson unit vocabulary, sentences, and learner word strengths for the Lesson Director",
    value: unit
      ? {
          unit: {
            unit_id: unit.unit_id,
            title: unit.title,
            world_id: unit.world_id,
            vocab: unit.vocab,
            sentences: unit.sentences,
          },
          word_strengths: wordStrengths,
        }
      : null,
  });

  useEffect(() => {
    if (prevUnitIdRef.current && prevUnitIdRef.current !== unitId) {
      lessonStartSent.delete(prevUnitIdRef.current);
    }
    prevUnitIdRef.current = unitId;

    useLessonStore.getState().reset();
    pendingExerciseRespondRef.current = null;
    pendingJudgmentRef.current = null;
    lastAssistantMessageRef.current = null;
  }, [unitId]);

  useEffect(() => {
    if (!unit) return;

    const wordIds = unit.vocab.map((v) => v.word_id).join(",");
    fetch(`/api/redis/word-strengths?uid=demo&word_ids=${wordIds}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load word strengths");
        return res.json();
      })
      .then((data: { strengths: WordStrength[] }) => {
        setWordStrengths(data.strengths);
      })
      .catch(() => {
        setLoadError("Could not load learner progress.");
      });
  }, [unit]);

  useEffect(() => {
    if (!unit || loadError) return;

    if (lessonStartSent.has(unitId)) return;

    lessonStartSent.add(unitId);
    appendMessage(
      new TextMessage({
        role: Role.User,
        content: `Start the lesson for unit "${unit.title}" (${unit.unit_id}). Use the vocabulary, sentences, and word strengths provided in context.`,
      })
    );
  }, [unit, unitId, loadError, appendMessage]);

  useEffect(() => {
    const assistants = (messages ?? []).filter(
      (message) =>
        message.role === "assistant" && typeof message.content === "string"
    );
    const last = assistants[assistants.length - 1];
    if (!last || typeof last.content !== "string" || !pendingJudgmentRef.current)
      return;

    const text = last.content;
    if (!text || text === lastAssistantMessageRef.current) return;

    lastAssistantMessageRef.current = text;

    if (/Bien joué|Exactement|Parfait/i.test(text)) {
      setFeedback("correct");
      addXp(10);
    } else if (/Presque/i.test(text)) {
      setFeedback("wrong");
      loseHeart();
      const wordId = pendingJudgmentRef.current.wordId;
      if (wordId) addMissed(wordId);
    }

    pendingJudgmentRef.current = null;
    const timer = setTimeout(() => setFeedback("idle"), 1500);
    return () => clearTimeout(timer);
  }, [messages, setFeedback, addXp, loseHeart, addMissed]);

  useEffect(() => {
    if (!unit || exerciseIndex < totalExercises - 2) return;
    fetch(`/worlds/${unit.world_id}.spz`).catch(() => {});
  }, [exerciseIndex, totalExercises, unit]);

  const handleSubmit = (exerciseId: string, response: unknown) => {
    const wordId = getWordId(useLessonStore.getState().currentExercise);
    pendingJudgmentRef.current = { wordId };

    pendingExerciseRespondRef.current?.({
      exercise_id: exerciseId,
      ...(typeof response === "object" && response !== null
        ? (response as Record<string, unknown>)
        : { response }),
    });
    pendingExerciseRespondRef.current = null;
  };

  if (!unit) {
    return (
      <div style={{ paddingTop: 96, textAlign: "center" }}>
        <p>Unit not found.</p>
      </div>
    );
  }

  if (loadError || agentError) {
    return (
      <div
        style={{ paddingTop: 96, maxWidth: 480, margin: "0 auto", padding: 24 }}
      >
        <LessonHUD />
        <p style={{ marginTop: 24, color: "#b91c1c", lineHeight: 1.5 }}>
          {loadError ||
            "Unable to connect to the lesson agent. Make sure the agent server is running on port 8000."}
        </p>
      </div>
    );
  }

  if (currentExercise?.type === "lesson.complete") {
    return (
      <LessonComplete exercise={currentExercise as LessonCompletePayload} />
    );
  }

  return (
    <div style={{ paddingTop: 80, minHeight: "100vh" }}>
      <LessonHUD />
      <LessonAgentBridge />

      {!currentExercise && (
        <p style={{ textAlign: "center", marginTop: 48, color: "#6b7280" }}>
          Preparing your lesson…
        </p>
      )}

      {currentExercise?.type === "exercise.multiple_choice" && (
        <MultipleChoice
          exercise={currentExercise}
          onSubmit={handleSubmit}
          feedbackState={feedbackState}
        />
      )}
      {currentExercise?.type === "exercise.word_bank" && (
        <WordBank
          exercise={currentExercise}
          onSubmit={handleSubmit}
          feedbackState={feedbackState}
        />
      )}
      {currentExercise?.type === "exercise.listening" && (
        <Listening
          exercise={currentExercise}
          onSubmit={handleSubmit}
          feedbackState={feedbackState}
        />
      )}
      {currentExercise?.type === "exercise.speak_it" && (
        <SpeakIt
          exercise={currentExercise}
          onSubmit={handleSubmit}
          feedbackState={feedbackState}
        />
      )}
    </div>
  );
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = use(params);
  const [agentError, setAgentError] = useState(false);

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="lesson_director"
      onError={() => setAgentError(true)}
    >
      <LessonExperience unitId={unitId} agentError={agentError} />
    </CopilotKit>
  );
}
