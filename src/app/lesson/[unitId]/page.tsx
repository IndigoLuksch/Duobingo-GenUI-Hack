"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CopilotKit,
  useCopilotChatInternal,
  useCopilotReadable,
} from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import LessonHUD from "@/components/LessonHUD";
import LessonAgentBridge from "@/components/LessonAgentBridge";
import LessonPrepLoader from "@/components/LessonPrepLoader";
import MultipleChoice from "@/components/exercises/MultipleChoice";
import WordBank from "@/components/exercises/WordBank";
import Listening from "@/components/exercises/Listening";
import SpeakIt from "@/components/exercises/SpeakIt";
import LessonComplete from "@/components/exercises/LessonComplete";
import StaticLessonExperience from "@/components/StaticLessonExperience";
import SkipToWorld from "@/components/SkipToWorld";
import { useCourse } from "@/lib/course-context";
import { LANGUAGE_LABELS } from "@/lib/courses";
import { findUnitById } from "@/lib/course-data";
import {
  pendingExerciseRespondRef,
  pendingJudgmentRef,
} from "@/lib/lessonAgentBridge";
import { getLessonPrepStepId } from "@/lib/lesson-prep-status";
import { hasStaticExercises } from "@/lib/static-lesson";
import { useLessonStore } from "@/lib/store";
import {
  ExercisePayload,
  LessonComplete as LessonCompletePayload,
  Unit,
  WordStrength,
} from "@/lib/types";
import styles from "./page.module.css";

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

function AgentLessonExperience({
  unitId,
  agentError,
}: {
  unitId: string;
  agentError: boolean;
}) {
  const router = useRouter();
  const { course, courseId, ready: courseReady } = useCourse();
  const language = LANGUAGE_LABELS[courseId];

  const builtInUnit = useMemo(
    () => course.units.find((u) => u.unit_id === unitId) ?? null,
    [course.units, unitId]
  );
  const [unit, setUnit] = useState<Unit | null>(builtInUnit);

  useEffect(() => {
    setUnit(findUnitById(courseId, unitId));
  }, [courseId, unitId]);

  const [wordStrengths, setWordStrengths] = useState<WordStrength[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prepTimedOut, setPrepTimedOut] = useState(false);
  const [lessonStartSent, setLessonStartSent] = useState(false);
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

  const prepStepId = useMemo(
    () =>
      getLessonPrepStepId({
        courseReady,
        unit,
        strengthsReady,
        agentAvailable: isAvailable,
        lessonStartSent,
        hasExercise: !!currentExercise,
      }),
    [
      courseReady,
      unit,
      strengthsReady,
      isAvailable,
      lessonStartSent,
      currentExercise,
    ]
  );

  const sendLessonStart = useCallback(() => {
    if (!unit) return;
    lessonStartSentRef.current = true;
    setLessonStartSent(true);
    setPrepTimedOut(false);

    const vocabLines = unit.vocab
      .map(
        (v) =>
          `  word_id="${v.word_id}" | target="${v.fr}" | en="${v.en}" | gender=${v.gender ?? "n"} | distractors=${JSON.stringify(v.distractors)}`
      )
      .join("\n");

    const sentenceLines = unit.sentences
      .map(
        (s) =>
          `  en="${s.en}" | target="${s.fr}" | tiles=${JSON.stringify(s.tiles)} | answer=${JSON.stringify(s.answer)}`
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
          `Start the lesson for unit "${unit.title}" (unit_id="${unit.unit_id}", world_id="${unit.world_id}", target_language="${language.name}").`,
          ``,
          `VOCABULARY — use these exact word_ids, ${language.name} target words (target field), and distractors when building exercises:`,
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
  }, [unit, wordStrengths, appendMessage, language.name]);

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
      setLessonStartSent(false);
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
      setLessonStartSent(true);
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

    if (
      new RegExp(language.feedbackCorrect.join("|"), "i").test(text)
    ) {
      setFeedback("correct");
      addXp(10);
    } else if (new RegExp(language.feedbackWrong.join("|"), "i").test(text)) {
      setFeedback("wrong");
      loseHeart();
      const wordId = pendingJudgmentRef.current.wordId;
      if (wordId) addMissed(wordId);
    }

    pendingJudgmentRef.current = null;
    const timer = setTimeout(() => setFeedback("idle"), 1500);
    return () => clearTimeout(timer);
  }, [messages, setFeedback, addXp, loseHeart, addMissed, language]);

  useEffect(() => {
    if (!unit || exerciseIndex < totalExercises - 2) return;
    const missed = useLessonStore.getState().missedWordIds.join(",");
    const query = missed ? `?missed=${missed}` : "";
    router.prefetch(`/world/${unit.world_id}${query}`);
    fetch(`/worlds/${unit.world_id}.spz`).catch(() => {});
  }, [exerciseIndex, totalExercises, unit, router]);

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

  if (!courseReady || !unit) {
    if (courseReady && !unit) {
      return (
        <div className={styles.notFound}>
          <p>Unit not found.</p>
        </div>
      );
    }

    return (
      <div className={styles.shell}>
        <LessonPrepLoader activeStepId={prepStepId} />
      </div>
    );
  }

  if (loadError || agentError) {
    return (
      <div className={styles.shell}>
        <LessonHUD />
        <div className={styles.stateBlock}>
          <p className={styles.errorText}>
            {loadError ||
              "Unable to connect to the lesson agent. Make sure the agent server is running on port 8000."}
          </p>
        </div>
      </div>
    );
  }

  if (currentExercise?.type === "lesson.complete") {
    return (
      <LessonComplete
        exercise={currentExercise as LessonCompletePayload}
        fallbackWorldId={unit.world_id}
      />
    );
  }

  return (
    <>
      <div className={`${styles.shell} withSkipBar`}>
        <LessonHUD />
        <LessonAgentBridge />

        {!currentExercise && (
        <LessonPrepLoader activeStepId={prepStepId}>
          {prepTimedOut && (
            <div className={styles.retryBlock}>
              <p>
                This is taking longer than expected. Make sure the lesson agent is
                running on port 8000.
              </p>
              <button
                type="button"
                className={`btnPrimary ${styles.retryButton}`}
                onClick={() => {
                  lessonStartSentRef.current = false;
                  setLessonStartSent(false);
                  sendLessonStart();
                }}
              >
                Try again
              </button>
            </div>
          )}
        </LessonPrepLoader>
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
      <SkipToWorld />
    </>
  );
}

function LessonRouter({
  unitId,
  agentError,
}: {
  unitId: string;
  agentError: boolean;
}) {
  const { courseId } = useCourse();
  const unit = useMemo(
    () => findUnitById(courseId, unitId),
    [courseId, unitId]
  );

  if (!unit) {
    return (
      <div className={styles.notFound}>
        <p>Unit not found.</p>
      </div>
    );
  }

  if (hasStaticExercises(unit)) {
    return <StaticLessonExperience unit={unit} />;
  }

  return <AgentLessonExperience unitId={unitId} agentError={agentError} />;
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = use(params);
  const { courseId } = useCourse();
  const unit = useMemo(
    () => findUnitById(courseId, unitId),
    [courseId, unitId]
  );
  const isStatic = unit ? hasStaticExercises(unit) : false;
  const [agentError, setAgentError] = useState(false);
  const lessonThreadId = useMemo(
    () => `lesson-${courseId}-${unitId}-${crypto.randomUUID()}`,
    [courseId, unitId]
  );

  if (isStatic) {
    return <LessonRouter unitId={unitId} agentError={false} />;
  }

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="lesson_director"
      threadId={lessonThreadId}
      onError={() => setAgentError(true)}
    >
      <LessonRouter unitId={unitId} agentError={agentError} />
    </CopilotKit>
  );
}
