"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import AppLogo from "@/components/ui/AppLogo";
import { LessonComplete as LessonCompletePayload } from "@/lib/types";
import PortalTransition, { buildPortalHref } from "@/components/PortalTransition";
import styles from "./LessonComplete.module.css";

interface Props {
  exercise: LessonCompletePayload;
  fallbackWorldId?: string;
}

export default function LessonComplete({ exercise, fallbackWorldId }: Props) {
  const router = useRouter();
  const [displayedXp, setDisplayedXp] = useState(0);
  const [portalOpen, setPortalOpen] = useState(false);
  const [memoryPlaceId, setMemoryPlaceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let start: number | null = null;
    const duration = 1200;

    const animate = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setDisplayedXp(Math.round(progress * exercise.xp_gained));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [exercise.xp_gained]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pending_memory_place");
      if (saved) {
        const parsed = JSON.parse(saved) as { placeId: string };
        setMemoryPlaceId(parsed.placeId);
      }
    } catch {
      // ignore
    }
  }, []);

  const unitLabel = exercise.unit_title.replace(/^In the /, "").replace(/^At the /, "");
  const worldId = exercise.world_id || fallbackWorldId || "";

  useEffect(() => {
    if (!worldId) return;
    const href = buildPortalHref(worldId, exercise.missed_word_ids, memoryPlaceId);
    router.prefetch(href);
  }, [worldId, exercise.missed_word_ids, memoryPlaceId, router]);

  return (
    <PortalTransition
      active={portalOpen}
      worldId={worldId}
      missedIds={exercise.missed_word_ids}
      memoryPlaceId={memoryPlaceId}
      onComplete={() => {
        localStorage.removeItem("pending_memory_place");
        setPortalOpen(false);
      }}
    >
      <div className={styles.complete}>
        <motion.div
          className={styles.pulseBg}
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className={styles.card}>
          <div className={styles.logoWrap}>
            <AppLogo height={24} />
          </div>
          <h1 className={styles.heading}>Lesson Complete!</h1>
          <div className={styles.xpCounter}>{displayedXp}</div>
          <p className={styles.xpLabel}>XP earned</p>

          {exercise.missed_word_ids.length > 0 && (
            <div className={styles.missed}>
              Let&apos;s find these in the world!
              <div className={styles.missedWords}>
                {exercise.missed_word_ids.join(", ")}
              </div>
            </div>
          )}

          <button
            type="button"
            className={styles.cta}
            onClick={() => setPortalOpen(true)}
            disabled={!worldId}
          >
            Enter the {unitLabel} →
          </button>
        </div>
      </div>
    </PortalTransition>
  );
}
