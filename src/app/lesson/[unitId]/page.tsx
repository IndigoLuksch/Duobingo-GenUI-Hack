"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import course from "../../../../data/courses/de.json";
import {
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

function hasLessonStartMessage(
  messages: { role?: string; content?: unknown }[] | undefined,
  unitId: string
): boolean {
  return (messages ?? []).some(
    (message) =>
      message.role === "user" &&
      typeof message.content === "string" &&
      message.content.includes(unitId)
  );
}

function parseExerciseFromText(text: string): ExercisePayload | null {
  const start = text.indexOf('{"type"');
  if (start === -1) return null;

  const candidate = text.slice(start);
  const end = candidate.lastIndexOf("}");
  if (end === -1) return null;

  try {
    const parsed = JSON.parse(candidate.slice(0, end + 1)) as ExercisePayload;
    if (
      parsed?.type?.startsWith("exercise.") ||
      parsed?.type === "lesson.complete"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

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
  const [prepTimedOut, setPrepTimedOut] = useState(false);
  const lastAssistantMessageRef = useRef<string | null>(null);
  const lessonStartSentRef = useRef(false);
  const prevUnitIdRef = useRef(unitId);

  const currentExercise = useLessonStore((s) => s.currentExercise);
  const feedbackState = useLessonStore((s) => s.feedbackState);
  const exerciseIndex = useLessonStore((s) => s.exerciseIndex);
  const totalExercises = useLessonStore((s) => s.totalExercises);
  const setFeedback = useLessonStore((s) => s.setFeedback);
  const addXp = useLessonStore((s) => s.addXp);
  const loseHeart = useLessonStore((s) => s.loseHeart);
  const addMissed = useLessonStore((s) => s.addMissed);

  const { appendMessage, messages, isAvailable, isLoading } =
    useCopilotChatInternal();

  const strengthsReady = wordStrengths.length > 0;

  const sendLessonStart = useCallback(() => {
    if (!unit) return;
    lessonStartSentRef.current = true;
    setPrepTimedOut(false);

    const vocabLines = unit.vocab
      .map(
        (v) =>
          `  word_id="${v.word_id}" | fr="${v.fr}" | en="${v.en}" | gender=${v.gender ?? "n"} | distractors=${JSON.stringify(v.distractors)}`
      )
      .join("\n");

    const sentenceLines = unit.sentences
      .map(
        (s) =>
          `  en="${s.en}" | fr="${s.fr}" | tiles=${JSON.stringify(s.tiles)} | answer=${JSON.stringify(s.answer)}`
      )
      .join("\n");

    const defaultStrengths = unit.vocab.map((v) => ({
      word_id: v.word_id,
      strength: 0.5,
    }));
    const strengths = wordStrengths.length > 0 ? wordStrengths : defaultStrengths;
    const strengthLines = strengths
      .map((w) => `  ${w.word_id}: ${w.strength.toFixed(2)}`)
      .join("\n");

    appendMessage(
      new TextMessage({
        role: Role.User,
        content: [
          `Start the lesson for unit "${unit.title}" (unit_id="${unit.unit_id}", world_id="${unit.world_id}").`,
          ``,
          `VOCABULARY — use these exact word_ids, French words, and distractors when building exercises:`,
          vocabLines,
          ``,
          `SENTENCES — use these for word_bank exercises (tiles and answer are exact):`,
          sentenceLines,
          ``,
          `WORD STRENGTHS (0.0 = weakest/highest priority, 1.0 = strongest):`,
          strengthLines,
          ``,
          `Plan and deliver exactly 8 exercises using the show_exercise tool. Start with the 2 weakest words. Begin immediately.`,
        ].join("\n"),
      })
    );
  }, [unit, wordStrengths, appendMessage]);

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
    if (prevUnitIdRef.current !== unitId) {
      lessonStartSentRef.current = false;
      prevUnitIdRef.current = unitId;
    }
    setPrepTimedOut(false);
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
    if (!unit || loadError || !isAvailable || !strengthsReady || isLoading) {
      return;
    }
    if (lessonStartSentRef.current) return;
    if (hasLessonStartMessage(messages, unitId)) {
      lessonStartSentRef.current = true;
      return;
    }

    const timer = setTimeout(() => {
      if (lessonStartSentRef.current) return;
      sendLessonStart();
    }, 300);

    return () => clearTimeout(timer);
  }, [
    unit,
    unitId,
    loadError,
    isAvailable,
    strengthsReady,
    isLoading,
    messages,
    sendLessonStart,
  ]);

  useEffect(() => {
    if (currentExercise) return;

    const assistants = (messages ?? []).filter(
      (message) =>
        message.role === "assistant" && typeof message.content === "string"
    );

    for (let i = assistants.length - 1; i >= 0; i -= 1) {
      const payload = parseExerciseFromText(assistants[i].content as string);
      if (!payload) continue;

      const { setExercise, advanceIndex, setFeedback } =
        useLessonStore.getState();
      setExercise(payload);
      setFeedback("idle");
      if (payload.type.startsWith("exercise.")) {
        advanceIndex();
      }
      break;
    }
  }, [messages, currentExercise]);

  useEffect(() => {
    if (currentExercise) {
      setPrepTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setPrepTimedOut(true), 60_000);
    return () => clearTimeout(timer);
  }, [currentExercise, unitId]);

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

    const payload =
      typeof response === "object" && response !== null
        ? (response as Record<string, unknown>)
        : { response };

    if (pendingExerciseRespondRef.current) {
      pendingExerciseRespondRef.current({
        exercise_id: exerciseId,
        ...payload,
      });
      pendingExerciseRespondRef.current = null;
      return;
    }

    appendMessage(
      new TextMessage({
        role: Role.User,
        content: `My answer for exercise ${exerciseId}: ${JSON.stringify(payload)}`,
      })
    );
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
        <div style={{ textAlign: "center", marginTop: 48, color: "#6b7280" }}>
          <p>Preparing your lesson…</p>
          {prepTimedOut && (
            <div style={{ marginTop: 16, maxWidth: 420, marginInline: "auto", lineHeight: 1.5 }}>
              <p>
                This is taking longer than expected. Make sure the lesson agent is
                running on port 8000.
              </p>
              <button
                type="button"
                onClick={() => {
                  lessonStartSentRef.current = false;
                  sendLessonStart();
                }}
                style={{
                  marginTop: 12,
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#4f46e5",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
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
  const lessonThreadId = useMemo(
    () => `lesson-${unitId}-${crypto.randomUUID()}`,
    [unitId]
  );

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="lesson_director"
      threadId={lessonThreadId}
      onError={() => setAgentError(true)}
    >
      <LessonExperience unitId={unitId} agentError={agentError} />
    </CopilotKit>
  );
}
