"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWorldStore } from "@/lib/store";
import { WorldCardData } from "@/lib/types";
import styles from "./WorldCard.module.css";

const POSITION_CLASS: Record<WorldCardData["position_hint"], string> = {
  center: styles.center,
  "top-left": styles.topLeft,
  "top-right": styles.topRight,
  "bottom-left": styles.bottomLeft,
  "bottom-right": styles.bottomRight,
};

function genderChipClass(gender: WorldCardData["gender"]): string {
  if (gender === "m") return styles.chipM;
  if (gender === "f") return styles.chipF;
  return styles.chipN;
}

function playWord(word: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "fr-FR";
  window.speechSynthesis.speak(utterance);
}

function CardItem({ card }: { card: WorldCardData }) {
  const removeCard = useWorldStore((s) => s.removeCard);
  const [dismissing, setDismissing] = useState(false);
  const [authenticVisible, setAuthenticVisible] = useState(false);
  const isCenter = card.position_hint === "center";
  const centerOffset = isCenter ? { x: "-50%", y: "-50%" } : {};

  useEffect(() => {
    const dismissTimer = setTimeout(() => setDismissing(true), 15000);
    return () => clearTimeout(dismissTimer);
  }, []);

  useEffect(() => {
    if (card.authentic_sentence) {
      const id = requestAnimationFrame(() => setAuthenticVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setAuthenticVisible(false);
  }, [card.authentic_sentence]);

  return (
    <motion.div
      className={`${styles.card} ${POSITION_CLASS[card.position_hint]}`}
      initial={{ scale: 0.8, opacity: 0, ...centerOffset }}
      animate={{
        scale: dismissing ? 0.95 : 1,
        opacity: dismissing ? 0 : 1,
        ...centerOffset,
      }}
      transition={
        dismissing
          ? { duration: 0.4, ease: "easeOut" }
          : { type: "spring", stiffness: 320, damping: 24 }
      }
      onAnimationComplete={() => {
        if (dismissing) removeCard(card.id);
      }}
    >
      <div className={styles.header}>
        <div>
          <p className={styles.word}>{card.word}</p>
          <p className={styles.translation}>{card.translation}</p>
        </div>
        <span className={`${styles.chip} ${genderChipClass(card.gender)}`}>
          {card.gender ?? "n"}
        </span>
      </div>

      {card.example_sentence && (
        <p className={styles.example}>{card.example_sentence}</p>
      )}

      {card.authentic_sentence && (
        <p
          className={`${styles.authentic} ${
            authenticVisible ? styles.authenticVisible : styles.authenticHidden
          }`}
        >
          📖 {card.authentic_sentence}
          {card.authentic_source && (
            <span className={styles.source}>— {card.authentic_source}</span>
          )}
        </p>
      )}

      <button
        type="button"
        className={styles.audioButton}
        onClick={() => playWord(card.word)}
      >
        ▶ Audio
      </button>
    </motion.div>
  );
}

export default function WorldCard() {
  const cards = useWorldStore((s) => s.cards);

  return (
    <div className={styles.container}>
      <AnimatePresence>
        {cards.map((card) => (
          <CardItem key={card.id} card={card} />
        ))}
      </AnimatePresence>
    </div>
  );
}
