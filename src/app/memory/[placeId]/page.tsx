"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SplatScene from "@/components/SplatScene";
import PanoViewer from "@/components/PanoViewer";
import GeminiLiveController from "@/components/GeminiLiveController";
import WorldCard from "@/components/WorldCard";
import WorldHUD from "@/components/WorldHUD";
import course from "../../../../data/courses/fr.json";
import { useWorldStore } from "@/lib/store";
import { Course, MemoryPlaceRecord, WordStrength } from "@/lib/types";
import worldStyles from "../../world/[worldId]/page.module.css";
import styles from "./page.module.css";

const typedCourse = course as Course;

export default function MemoryPlacePage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = use(params);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [memory, setMemory] = useState<MemoryPlaceRecord | null>(null);
  const [wordStrengths, setWordStrengths] = useState<WordStrength[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const unit = useMemo(() => {
    if (!memory?.unit_id) return null;
    return typedCourse.units.find((u) => u.unit_id === memory.unit_id) ?? null;
  }, [memory?.unit_id]);

  const strengthsReady = wordStrengths.length > 0;
  const sceneReady =
    memory?.pano_status === "ready" &&
    Boolean(memory.pano_url || memory.spz_url);

  useEffect(() => {
    useWorldStore.getState().reset();
    useWorldStore.getState().setMissedWordIds([]);
  }, [placeId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(
        `/api/memory-place/status?uid=demo&place_id=${encodeURIComponent(placeId)}`
      );
      if (!res.ok) {
        if (!cancelled) setLoadError("Memory place not found.");
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setMemory({
          place_id: placeId,
          place_name: data.place_name,
          unit_id: data.unit_id,
          source_photo_url: data.pano_url ?? "",
          pano_url: data.pano_url,
          pano_status: data.pano_status,
          spz_url: data.spz_url,
          world_status: data.world_status,
          world_operation_id: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    void load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [placeId]);

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
      .catch(() => setLoadError("Could not load learner progress."));
  }, [unit]);

  const handleExit = () => {
    useWorldStore.getState().reset();
    router.push("/");
  };

  if (loadError) {
    return (
      <div className={worldStyles.error}>
        <p>{loadError}</p>
        <button
          type="button"
          className={worldStyles.exitButton}
          onClick={handleExit}
        >
          ✕ Exit
        </button>
      </div>
    );
  }

  if (!memory || !unit) {
    return (
      <div className={styles.loading}>
        <p>Loading your memory…</p>
      </div>
    );
  }

  if (!sceneReady) {
    return (
      <div className={styles.loading}>
        <p>Building panorama for {memory.place_name}…</p>
      </div>
    );
  }

  const extraContextLine = `The learner chose to practice in ${memory.place_name}, a real place they have visited.`;

  return (
    <div className={worldStyles.page}>
      {memory.spz_url ? (
        <SplatScene splatUrl={memory.spz_url} canvasRef={canvasRef} />
      ) : (
        <PanoViewer panoUrl={memory.pano_url!} canvasRef={canvasRef} />
      )}

      {strengthsReady && (
        <div className={worldStyles.overlayLayer}>
          <GeminiLiveController
            canvasRef={canvasRef}
            missedWordIds={[]}
            unitVocab={unit.vocab}
            wordStrengths={wordStrengths}
            unitTitle={unit.title}
            extraContextLine={extraContextLine}
          />
          <WorldCard />
          <WorldHUD />
        </div>
      )}

      {memory.world_status === "generating" && (
        <div className={styles.generatingChip}>
          Full world generating… check back tomorrow
        </div>
      )}

      <button
        type="button"
        className={worldStyles.exitButton}
        onClick={handleExit}
      >
        ✕ Exit
      </button>
    </div>
  );
}
