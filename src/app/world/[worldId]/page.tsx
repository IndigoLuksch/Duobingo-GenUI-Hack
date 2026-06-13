"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import SplatScene from "@/components/SplatScene";
import GeminiLiveController from "@/components/GeminiLiveController";
import WorldCard from "@/components/WorldCard";
import WorldHUD from "@/components/WorldHUD";
import { useCourse } from "@/lib/course-context";
import { findUnitByWorldId, getSplatWorldId } from "@/lib/course-data";
import { useWorldStore } from "@/lib/store";
import { WordStrength, Unit } from "@/lib/types";
import styles from "./page.module.css";

export default function WorldPage({
  params,
  searchParams,
}: {
  params: Promise<{ worldId: string }>;
  searchParams: Promise<{ missed?: string }>;
}) {
  const { worldId } = use(params);
  const { missed } = use(searchParams);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { course, courseId } = useCourse();

  const [wordStrengths, setWordStrengths] = useState<WordStrength[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showEnterOverlay, setShowEnterOverlay] = useState(true);

  const missedWordIds = useMemo(
    () => missed?.split(",").map((id) => id.trim()).filter(Boolean) ?? [],
    [missed]
  );

  const builtInUnit = useMemo(
    () => course.units.find((u) => u.world_id === worldId) ?? null,
    [course.units, worldId]
  );
  const [unit, setUnit] = useState<Unit | null>(builtInUnit);

  useEffect(() => {
    setUnit(findUnitByWorldId(courseId, worldId));
  }, [courseId, worldId]);

  const splatUrl = unit ? `/worlds/${getSplatWorldId(unit)}.spz` : "";

  const strengthsReady = wordStrengths.length > 0;

  useEffect(() => {
    useWorldStore.getState().reset();
    useWorldStore.getState().setMissedWordIds(missedWordIds);
    setReady(true);
  }, [worldId, missedWordIds]);

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

  const handleExit = () => {
    useWorldStore.getState().reset();
    router.push("/");
  };

  if (!unit) {
    return (
      <div className={styles.error}>
        <p>World not found.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.error}>
        <p>{loadError}</p>
        <button type="button" className={styles.exitButton} onClick={handleExit}>
          ✕ Exit
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} aria-hidden />
        <p>Loading your world…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SplatScene
        splatUrl={splatUrl}
        canvasRef={canvasRef}
      />

      {!strengthsReady && !loadError && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} aria-hidden />
          <p>Preparing vocabulary…</p>
        </div>
      )}

      {strengthsReady && (
        <div className={styles.overlayLayer}>
          <GeminiLiveController
            canvasRef={canvasRef}
            missedWordIds={missedWordIds}
            unitVocab={unit.vocab}
            wordStrengths={wordStrengths}
            unitTitle={unit.title}
            courseId={courseId}
          />
          <WorldCard />
          <WorldHUD />
        </div>
      )}

      <button
        type="button"
        className={styles.exitButton}
        onClick={handleExit}
      >
        ✕ Exit
      </button>

      {showEnterOverlay && (
        <motion.div
          className={styles.enterOverlay}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          onAnimationComplete={() => setShowEnterOverlay(false)}
        />
      )}
    </div>
  );
}
