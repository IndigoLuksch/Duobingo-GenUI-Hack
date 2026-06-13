"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLessonStore } from "@/lib/store";
import styles from "./LessonHUD.module.css";

const TOTAL_HEARTS = 3;

function HeartIcon({
  alive,
  isDying,
}: {
  alive: boolean;
  isDying: boolean;
}) {
  return (
    <motion.span
      className={`${styles.heart} ${!alive && !isDying ? styles.heartLost : ""}`}
      initial={false}
      animate={
        isDying
          ? {
              scale: [1, 1.3, 1],
              rotate: [0, -5, 5, -5, 0],
              opacity: [1, 1, 0.35],
              filter: ["grayscale(0)", "grayscale(0)", "grayscale(1)"],
            }
          : alive
            ? { scale: 1, rotate: 0, opacity: 1, filter: "grayscale(0)" }
            : { scale: 1, rotate: 0, opacity: 0.35, filter: "grayscale(1)" }
      }
      transition={
        isDying
          ? { duration: 0.4, ease: "easeInOut" }
          : { duration: 0.15 }
      }
      aria-hidden
    >
      ❤️
    </motion.span>
  );
}

export default function LessonHUD() {
  const exerciseIndex = useLessonStore((s) => s.exerciseIndex);
  const totalExercises = useLessonStore((s) => s.totalExercises);
  const hearts = useLessonStore((s) => s.hearts);
  const xp = useLessonStore((s) => s.xp);

  const prevHeartsRef = useRef(hearts);
  const prevXpRef = useRef(xp);
  const [dyingHeartIndex, setDyingHeartIndex] = useState<number | null>(null);
  const [xpPopup, setXpPopup] = useState<{ id: number; amount: number } | null>(
    null
  );

  useEffect(() => {
    if (hearts < prevHeartsRef.current) {
      setDyingHeartIndex(hearts);
      const timer = setTimeout(() => setDyingHeartIndex(null), 400);
      prevHeartsRef.current = hearts;
      return () => clearTimeout(timer);
    }
    prevHeartsRef.current = hearts;
  }, [hearts]);

  useEffect(() => {
    if (xp > prevXpRef.current) {
      const amount = xp - prevXpRef.current;
      setXpPopup({ id: Date.now(), amount });
      prevXpRef.current = xp;
    } else {
      prevXpRef.current = xp;
    }
  }, [xp]);

  return (
    <>
      <header className={styles.hud}>
        <div className={styles.dots} aria-label="Lesson progress">
          {Array.from({ length: totalExercises }, (_, i) => {
            const isCompleted = i < exerciseIndex;
            const isCurrent = i === exerciseIndex;
            const isUpcoming = i > exerciseIndex;

            return (
              <motion.span
                key={i}
                className={`${styles.dot} ${
                  isCompleted
                    ? styles.dotCompleted
                    : isCurrent
                      ? styles.dotCurrent
                      : styles.dotUpcoming
                }`}
                animate={
                  isCurrent ? { scale: [1, 1.25, 1] } : { scale: 1 }
                }
                transition={
                  isCurrent
                    ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                    : undefined
                }
              />
            );
          })}
        </div>

        <div className={styles.hearts} aria-label={`${hearts} hearts remaining`}>
          {Array.from({ length: TOTAL_HEARTS }, (_, i) => (
            <HeartIcon
              key={i}
              alive={i < hearts}
              isDying={dyingHeartIndex === i}
            />
          ))}
        </div>
      </header>

      <AnimatePresence>
        {xpPopup && (
          <motion.div
            key={xpPopup.id}
            className={styles.xpPopup}
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -30, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            onAnimationComplete={() => setXpPopup(null)}
          >
            +{xpPopup.amount} XP
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
