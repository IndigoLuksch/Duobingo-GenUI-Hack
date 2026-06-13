"use client";

import { useEffect, useState } from "react";
import LoadingState from "@/components/ui/LoadingState";
import LoadingStatusSteps, {
  type LoadingStatusStep,
} from "@/components/ui/LoadingStatusSteps";

export const LESSON_PREP_STEPS: LoadingStatusStep[] = [
  { id: "course", label: "Loading your course" },
  { id: "progress", label: "Loading your progress" },
  { id: "connect", label: "Connecting to your tutor" },
  { id: "plan", label: "Planning your lesson" },
  { id: "exercise", label: "Preparing first exercise" },
];

const INDETERMINATE_STEP_MS = 2800;

interface LessonPrepLoaderProps {
  activeStepId?: string;
  message?: string;
  indeterminate?: boolean;
  children?: React.ReactNode;
}

export default function LessonPrepLoader({
  activeStepId = "course",
  message,
  indeterminate = false,
  children,
}: LessonPrepLoaderProps) {
  const [indeterminateStepId, setIndeterminateStepId] = useState(
    LESSON_PREP_STEPS[0].id
  );

  useEffect(() => {
    if (!indeterminate) return;

    let index = 0;
    setIndeterminateStepId(LESSON_PREP_STEPS[index].id);

    const timer = setInterval(() => {
      index = Math.min(index + 1, LESSON_PREP_STEPS.length - 1);
      setIndeterminateStepId(LESSON_PREP_STEPS[index].id);
      if (index >= LESSON_PREP_STEPS.length - 1) {
        clearInterval(timer);
      }
    }, INDETERMINATE_STEP_MS);

    return () => clearInterval(timer);
  }, [indeterminate]);

  const stepId = indeterminate ? indeterminateStepId : activeStepId;
  const activeStep = LESSON_PREP_STEPS.find((step) => step.id === stepId);
  const statusMessage = message ?? activeStep?.label ?? "Preparing your lesson…";

  return (
    <LoadingState message={statusMessage}>
      <LoadingStatusSteps steps={LESSON_PREP_STEPS} activeStepId={stepId} />
      {children}
    </LoadingState>
  );
}
