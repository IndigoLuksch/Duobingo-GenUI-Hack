"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SplatScene from "@/components/SplatScene";
import PanoViewer from "@/components/PanoViewer";
import GeminiLiveController from "@/components/GeminiLiveController";
import WorldCard from "@/components/WorldCard";
import WorldHUD from "@/components/WorldHUD";
import { useCourse } from "@/lib/course-context";
import { findUnitById } from "@/lib/course-data";
import { useWorldStore } from "@/lib/store";
import { MemoryPlaceRecord, WordStrength } from "@/lib/types";
import worldStyles from "../../world/[worldId]/page.module.css";
import styles from "./page.module.css";

const EMPTY_MISSED: string[] = [];

export default function MemoryPlacePage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = use(params);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { courseId } = useCourse();

  const [memory, setMemory] = useState<MemoryPlaceRecord | null>(null);
  const [wordStrengths, setWordStrengths] = useState<WordStrength[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryingWorld, setRetryingWorld] = useState(false);
  const [splatReady, setSplatReady] = useState(false);

  const unit = useMemo(() => {
    if (!memory?.unit_id) return null;
    return findUnitById(courseId, memory.unit_id);
  }, [memory?.unit_id, courseId]);

  const strengthsReady = wordStrengths.length > 0;
  const sceneReady =
    memory?.pano_status === "ready" &&
    Boolean(memory.pano_url || memory.spz_url);

  useEffect(() => {
    setSplatReady(false);
  }, [memory?.spz_url]);

  useEffect(() => {
    useWorldStore.getState().reset();
    useWorldStore.getState().setMissedWordIds([]);
  }, [placeId]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<boolean> {
      const res = await fetch(
        `/api/memory-place/status?uid=demo&place_id=${encodeURIComponent(placeId)}`
      );
      if (!res.ok) {
        if (!cancelled) setLoadError("Memory place not found.");
        return false;
      }
      const data = await res.json();
      if (!cancelled) {
        setMemory({
          place_id: placeId,
          place_name: data.place_name,
          unit_id: data.unit_id,
          source: data.source,
          source_photo_url: data.source_photo_url ?? data.pano_url ?? "",
          pano_url: data.pano_url,
          pano_status: data.pano_status,
          spz_url: data.spz_url,
          world_status: data.world_status,
          world_operation_id: data.world_operation_id ?? null,
          world_id: data.world_id ?? null,
          created_at: new Date().toISOString(),
        });
      }
      const sceneReady =
        data.pano_status === "ready" &&
        Boolean(data.pano_url || data.spz_url);
      const worldStillGenerating = data.world_status === "generating";

      if (
        !cancelled &&
        data.pano_status !== "generating" &&
        !data.pano_url &&
        !data.spz_url &&
        data.world_id
      ) {
        router.replace(`/world/${data.world_id}`);
        return false;
      }

      return !sceneReady || worldStillGenerating;
    }

    void load();
    const interval = setInterval(() => {
      void load().then((shouldPoll) => {
        if (!shouldPoll) clearInterval(interval);
      });
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [placeId, router]);

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

  const handleBuildWorld = async () => {
    setRetryingWorld(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/memory-place/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: "demo", place_id: placeId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start 3D world generation");
      }
      setMemory((current) =>
        current
          ? {
              ...current,
              spz_url: null,
              world_status: "generating",
              world_operation_id: null,
              world_id: null,
              pano_status: "generating",
            }
          : current
      );
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not start 3D world generation."
      );
    } finally {
      setRetryingWorld(false);
    }
  };

  const showPanoFallback =
    Boolean(memory?.pano_url) &&
    !memory?.spz_url &&
    memory?.world_status === "not_started" &&
    !memory?.world_operation_id;

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

  const extraContextLine =
    memory.source === "street_view"
      ? `The learner is practicing at ${memory.place_name}, shown in Google Street View. A full 3D world is being generated in the background — encourage them to look around and explore while they wait.`
      : `The learner chose to practice in ${memory.place_name}, a real place they have visited.`;
  const hasSplat = Boolean(memory.spz_url);
  const showPano = Boolean(memory.pano_url) && (!hasSplat || !splatReady);

  return (
    <div className={worldStyles.page}>
      {showPano && (
        <PanoViewer panoUrl={memory.pano_url!} canvasRef={canvasRef} />
      )}

      {hasSplat && (
        <div
          className={`${styles.splatLayer} ${splatReady ? styles.splatLayerVisible : ""}`}
        >
          <SplatScene
            splatUrl={memory.spz_url!}
            canvasRef={canvasRef}
            onReady={() => setSplatReady(true)}
          />
        </div>
      )}

      {strengthsReady && (
        <div className={worldStyles.overlayLayer}>
          <GeminiLiveController
            canvasRef={canvasRef}
            missedWordIds={EMPTY_MISSED}
            unitVocab={unit.vocab}
            wordStrengths={wordStrengths}
            unitTitle={unit.title}
            courseId={courseId}
            extraContextLine={extraContextLine}
          />
          <WorldCard />
          <WorldHUD />
        </div>
      )}

      {memory.world_status === "generating" && (
        <div className={styles.generatingChip}>
          {memory.source === "street_view"
            ? "Building your 3D world… you'll switch automatically when it's ready"
            : "Full world generating… check back in a few minutes"}
        </div>
      )}

      {showPanoFallback && (
        <div className={styles.fallbackBanner}>
          <p>Showing the place photo. The 3D world was not generated for this location.</p>
          <button
            type="button"
            className={styles.buildWorldButton}
            onClick={handleBuildWorld}
            disabled={retryingWorld}
          >
            {retryingWorld ? "Starting…" : "Build 3D world"}
          </button>
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
