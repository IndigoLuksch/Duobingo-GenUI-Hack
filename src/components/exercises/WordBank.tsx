"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { WordBankExercise } from "@/lib/types";
import styles from "./exercises.module.css";

interface Props {
  exercise: WordBankExercise;
  onSubmit: (id: string, response: { selected_tiles: string[] }) => void;
  feedbackState: "idle" | "correct" | "wrong";
}

interface TileItem {
  id: string;
  text: string;
}

export default function WordBank({ exercise, onSubmit, feedbackState }: Props) {
  const initialTiles = useMemo(
    () =>
      exercise.tiles.map((text, index) => ({
        id: `${exercise.exercise_id}-${index}`,
        text,
      })),
    [exercise.exercise_id, exercise.tiles]
  );

  const [gridTiles, setGridTiles] = useState<TileItem[]>(initialTiles);
  const [answerTiles, setAnswerTiles] = useState<TileItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  useEffect(() => {
    setGridTiles(initialTiles);
    setAnswerTiles([]);
    setSubmitted(false);
    setShowCorrectAnswer(false);
  }, [initialTiles]);

  useEffect(() => {
    if (feedbackState === "wrong") {
      const timer = setTimeout(() => setShowCorrectAnswer(true), 300);
      return () => clearTimeout(timer);
    }
    setShowCorrectAnswer(false);
  }, [feedbackState]);

  const moveToAnswer = (tile: TileItem) => {
    if (submitted) return;
    setGridTiles((prev) => prev.filter((t) => t.id !== tile.id));
    setAnswerTiles((prev) => [...prev, tile]);
  };

  const moveToGrid = (tile: TileItem) => {
    if (submitted) return;
    setAnswerTiles((prev) => prev.filter((t) => t.id !== tile.id));
    setGridTiles((prev) => [...prev, tile]);
  };

  const handleCheck = () => {
    if (submitted || answerTiles.length === 0) return;
    setSubmitted(true);
    onSubmit(exercise.exercise_id, {
      selected_tiles: answerTiles.map((t) => t.text),
    });
  };

  return (
    <div className={styles.exercise}>
      <p className={styles.prompt}>Translate: {exercise.prompt_en}</p>

      <motion.div
        className={`${styles.answerRow} ${
          answerTiles.length > 0 ? styles.answerRowFilled : ""
        }`}
        animate={
          feedbackState === "correct"
            ? { backgroundColor: ["rgba(255,255,255,0.7)", "#dcfce7", "rgba(255,255,255,0.7)"] }
            : feedbackState === "wrong"
              ? { x: [0, -5, 5, -5, 0] }
              : undefined
        }
        transition={{ duration: feedbackState === "wrong" ? 0.3 : 0.3 }}
      >
        {answerTiles.map((tile) => (
          <motion.button
            key={tile.id}
            type="button"
            layoutId={tile.id}
            className={styles.tile}
            onClick={() => moveToGrid(tile)}
            disabled={submitted}
          >
            {tile.text}
          </motion.button>
        ))}
      </motion.div>

      <div className={styles.tileGrid}>
        {gridTiles.map((tile) => (
          <motion.button
            key={tile.id}
            type="button"
            layoutId={tile.id}
            className={styles.tile}
            onClick={() => moveToAnswer(tile)}
            disabled={submitted}
          >
            {tile.text}
          </motion.button>
        ))}
      </div>

      <button
        type="button"
        className={styles.checkBtn}
        disabled={answerTiles.length === 0 || submitted}
        onClick={handleCheck}
      >
        Check
      </button>

      {showCorrectAnswer && (
        <div className={styles.correctAnswer}>
          {exercise.answer.join(" ")}
        </div>
      )}
    </div>
  );
}
