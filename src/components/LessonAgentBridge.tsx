"use client";

import { useEffect } from "react";
import {
  useCopilotAction,
  type ActionRenderPropsWait,
} from "@copilotkit/react-core";
import {
  pendingExerciseRespondRef,
  pendingJudgmentRef,
} from "@/lib/lessonAgentBridge";
import { useLessonStore } from "@/lib/store";
import { ExercisePayload } from "@/lib/types";

function buildExercisePayload(args: Record<string, unknown>): ExercisePayload {
  return args as unknown as ExercisePayload;
}

function ShowExerciseHandler({
  args,
  status,
  respond,
}: ActionRenderPropsWait<[]> & { args: Record<string, unknown> }) {
  useEffect(() => {
    if (status === "executing" && respond) {
      pendingExerciseRespondRef.current = respond;
      const payload = buildExercisePayload(args);
      const { setExercise, advanceIndex, setFeedback } =
        useLessonStore.getState();
      setExercise(payload);
      setFeedback("idle");
      if (payload.type.startsWith("exercise.")) {
        advanceIndex();
      }
    } else {
      pendingExerciseRespondRef.current = null;
    }
  }, [args, status, respond]);

  return null;
}

export default function LessonAgentBridge() {
  useCopilotAction({
    name: "show_exercise",
    description:
      "Display an exercise payload to the learner and wait for their response",
    parameters: [
      { name: "type", type: "string", required: true },
      { name: "exercise_id", type: "string" },
      { name: "word_id", type: "string" },
      { name: "prompt", type: "string" },
      { name: "prompt_en", type: "string" },
      { name: "options", type: "string[]" },
      { name: "tiles", type: "string[]" },
      { name: "answer", type: "string[]" },
      { name: "answer_idx", type: "number" },
      { name: "audio_url", type: "string" },
      { name: "target_text", type: "string" },
      { name: "xp_gained", type: "number" },
      { name: "missed_word_ids", type: "string[]" },
      { name: "world_id", type: "string" },
      { name: "unit_title", type: "string" },
    ],
    renderAndWaitForResponse: (props) => (
      <ShowExerciseHandler {...props} args={props.args as Record<string, unknown>} />
    ),
  });

  return null;
}
