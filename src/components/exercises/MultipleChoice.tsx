"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MultipleChoiceExercise } from "@/lib/types";
import styles from "./exercises.module.css";

interface Props {
  exercise: MultipleChoiceExercise;
  onSubmit: (id: string, response: { selected_idx: number }) => void;
  feedbackState: "idle" | "correct" | "wrong";
}

export default function MultipleChoice({
  exercise,
  onSubmit,
  feedbackState,
}: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelectedIdx(null);
    setSubmitted(false);
  }, [exercise.exercise_id]);

  const handleSelect = (index: number) => {
    if (submitted) return;
    setSelectedIdx(index);
    setSubmitted(true);
    onSubmit(exercise.exercise_id, { selected_idx: index });
  };

  const playAudio = () => {
    if (exercise.audio_url) {
      new Audio(exercise.audio_url).play();
    }
  };

  return (
    <div className={styles.exercise}>
      <p className={styles.prompt}>{exercise.prompt}</p>

      {exercise.audio_url && (
        <button
          type="button"
          className={styles.audioBtn}
          onClick={playAudio}
          aria-label="Play audio"
        >
          🔊
        </button>
      )}

      <div className={styles.optionGrid}>
        {exercise.options.map((option, index) => {
          const isSelected = selectedIdx === index;
          const isCorrect = index === exercise.answer_idx;
          const showCorrect =
            feedbackState === "correct" && isCorrect;
          const showWrongShake =
            feedbackState === "wrong" && isSelected && !isCorrect;
          const showCorrectReveal =
            feedbackState === "wrong" && isCorrect;

          return (
            <motion.button
              key={`${exercise.exercise_id}-${index}`}
              type="button"
              className={`${styles.option} ${
                isSelected ? styles.optionSelected : ""
              } ${showCorrect || showCorrectReveal ? styles.optionCorrect : ""} ${
                submitted ? styles.optionDisabled : ""
              }`}
              onClick={() => handleSelect(index)}
              animate={
                showCorrect || showCorrectReveal
                  ? { scale: [1, 1.06, 1] }
                  : showWrongShake
                    ? { rotate: [0, -3, 3, -3, 0] }
                    : undefined
              }
              transition={{ duration: 0.3 }}
            >
              {option}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
