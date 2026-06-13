"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Unit } from "@/lib/types";
import styles from "./PathMap.module.css";

interface PathMapProps {
  units: Unit[];
  progress: Record<string, "locked" | "current" | "complete">;
  xp: number;
  streak: number;
  onStoreMemory?: () => void;
}

interface NodePosition {
  x: number;
  y: number;
}

function getNodePositions(count: number, width: number, height: number): NodePosition[] {
  if (count === 0) return [];

  const paddingTop = 80;
  const paddingBottom = 80;
  const usableHeight = Math.max(height - paddingTop - paddingBottom, 200);
  const spacing = count > 1 ? usableHeight / (count - 1) : 0;

  return Array.from({ length: count }, (_, i) => ({
    x: width * (i % 2 === 0 ? 0.38 : 0.62),
    y: paddingTop + i * spacing,
  }));
}

function buildPath(points: NodePosition[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function XpDisplay({ xp }: { xp: number }) {
  return (
    <div className={styles.xp}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={xp}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {xp} XP
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function PathMap({ units, progress, xp, streak, onStoreMemory }: PathMapProps) {
  const router = useRouter();
  const containerHeight = Math.max(520, units.length * 240);
  const containerWidth = 432;
  const positions = useMemo(
    () => getNodePositions(units.length, containerWidth, containerHeight),
    [units.length, containerHeight]
  );
  const pathD = useMemo(() => buildPath(positions), [positions]);

  const handleNodeClick = (unitId: string, status: string) => {
    if (status === "current" || status === "complete") {
      router.push(`/lesson/${unitId}`);
    }
  };

  return (
    <>
      <header className={styles.header}>
        <span className={styles.streak}>🔥 {streak}</span>
        <div className={styles.headerRight}>
          {onStoreMemory && (
            <button
              type="button"
              className={styles.memoryButton}
              onClick={onStoreMemory}
            >
              📍 Store a memory
            </button>
          )}
          <XpDisplay xp={xp} />
        </div>
      </header>

      <div className={styles.container} style={{ height: containerHeight }}>
        <svg
          className={styles.pathSvg}
          viewBox={`0 0 ${containerWidth} ${containerHeight}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <path className={styles.pathLine} d={pathD} />
        </svg>

        <div className={styles.nodes}>
          {units.map((unit, index) => {
            const status = progress[unit.unit_id] ?? "locked";
            const pos = positions[index];
            const isLocked = status === "locked";
            const isCurrent = status === "current";
            const isComplete = status === "complete";

            return (
              <div
                key={unit.unit_id}
                className={styles.nodeWrapper}
                style={{
                  left: `${(pos.x / containerWidth) * 100}%`,
                  top: pos.y,
                }}
              >
                <motion.button
                  type="button"
                  className={`${styles.node} ${
                    isLocked
                      ? styles.nodeLocked
                      : isCurrent
                        ? styles.nodeCurrent
                        : styles.nodeComplete
                  }`}
                  onClick={() => handleNodeClick(unit.unit_id, status)}
                  aria-label={unit.title}
                  animate={
                    isCurrent ? { scale: [1, 1.08, 1] } : undefined
                  }
                  transition={
                    isCurrent
                      ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                      : undefined
                  }
                  whileTap={!isLocked ? { scale: 0.95 } : undefined}
                >
                  {isCurrent && (
                    <motion.span
                      className={styles.pulseRing}
                      animate={{ scale: [1, 1.12, 1], opacity: [0.7, 0.35, 0.7] }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                  <span>{unit.icon}</span>
                  {isComplete && <span className={styles.checkmark}>✓</span>}
                </motion.button>

                {isLocked && <span className={styles.lockIcon}>🔒</span>}

                <span
                  className={`${styles.label} ${isLocked ? styles.labelLocked : ""}`}
                >
                  {unit.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
