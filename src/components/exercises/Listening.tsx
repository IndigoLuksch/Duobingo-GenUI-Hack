"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ListeningExercise } from "@/lib/types";
import styles from "./exercises.module.css";

interface Props {
  exercise: ListeningExercise;
  onSubmit: (id: string, response: { selected_idx: number }) => void;
  feedbackState: "idle" | "correct" | "wrong";
}

export default function Listening({ exercise, onSubmit, feedbackState }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const hasAutoPlayed = useRef(false);

  useEffect(() => {
    setSelectedIdx(null);
    setSubmitted(false);
    hasAutoPlayed.current = false;
  }, [exercise.exercise_id]);

  useEffect(() => {
    if (!hasAutoPlayed.current && exercise.audio_url) {
      hasAutoPlayed.current = true;
      new Audio(exercise.audio_url).play().catch(() => {});
    }
  }, [exercise.audio_url, exercise.exercise_id]);

  const playAudio = () => {
    new Audio(exercise.audio_url).play().catch(() => {});
  };

  const handleSelect = (index: number) => {
    if (submitted) return;
    setSelectedIdx(index);
    setSubmitted(true);
    onSubmit(exercise.exercise_id, { selected_idx: index });
  };

  return (
    <div className={styles.exercise}>
      <button
        type="button"
        className={`${styles.audioBtn} ${styles.audioBtnLarge}`}
        onClick={playAudio}
        aria-label="Play audio"
      >
        🔊
      </button>

      <div className={styles.optionColumn}>
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
              className={`${styles.option} ${styles.optionFull} ${
                isSelected ? styles.optionSelected : ""
              } ${showCorrect || showCorrectReveal ? styles.optionCorrect : ""} ${
                submitted ? styles.optionDisabled : ""
              }`}
              onClick={() => handleSelect(index)}
              animate={
                showCorrect || showCorrectReveal
                  ? { scale: [1, 1.04, 1] }
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
