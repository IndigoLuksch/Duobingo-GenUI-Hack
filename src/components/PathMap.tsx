"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLogo from "@/components/ui/AppLogo";
import CourseSwitcher from "@/components/CourseSwitcher";
import { Unit } from "@/lib/types";
import styles from "./PathMap.module.css";

interface PathMapProps {
  units: Unit[];
  progress: Record<string, "locked" | "current" | "complete">;
  xp: number;
  streak: number;
  courseTitle: string;
  courseFlag: string;
  onUnitClick: (unitId: string) => void;
  onNewLesson?: () => void;
}

interface NodePosition {
  x: number;
  y: number;
}

function getNodePositions(count: number, width: number, height: number): NodePosition[] {
  if (count === 0) return [];
  const paddingTop = 100;
  const paddingBottom = 100;
  const usableHeight = Math.max(height - paddingTop - paddingBottom, 200);
  const spacing = count > 1 ? usableHeight / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    x: width * (i % 2 === 0 ? 0.36 : 0.64),
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
    <div className={styles.xpChip}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={xp}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          ⚡ {xp} XP
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function PathMap({
  units,
  progress,
  xp,
  streak,
  courseTitle,
  courseFlag,
  onUnitClick,
  onNewLesson,
}: PathMapProps) {
  const nodeCount = units.length + (onNewLesson ? 1 : 0);
  const containerHeight = Math.max(760, nodeCount * 300);
  const containerWidth = 432;

  const positions = useMemo(
    () => getNodePositions(nodeCount, containerWidth, containerHeight),
    [nodeCount, containerHeight]
  );
  const pathD = useMemo(() => buildPath(positions), [positions]);

  const completeCount = Object.values(progress).filter((s) => s === "complete").length;

  const handleNodeClick = (unitId: string) => {
    onUnitClick(unitId);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.courseInfo}>
          <CourseSwitcher />
          <AppLogo height={26} className={styles.logo} />
          <div className={styles.courseText}>
            <span className={styles.courseName}>
              {courseFlag} {courseTitle}
            </span>
            <span className={styles.courseSubtitle}>
              {completeCount}/{units.length} lessons complete
            </span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.streakChip}>🔥 {streak}</span>
          <XpDisplay xp={xp} />
        </div>
      </header>

      <div className={styles.progressBarTrack}>
        <motion.div
          className={styles.progressBarFill}
          initial={{ width: 0 }}
          animate={{ width: `${units.length > 0 ? (completeCount / units.length) * 100 : 0}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>

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
            const rawStatus = progress[unit.unit_id] ?? "current";
            const status = rawStatus === "locked" ? "current" : rawStatus;
            const pos = positions[index];
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
                <span
                  className={`${styles.unitBadge} ${
                    isComplete
                      ? styles.unitBadgeComplete
                      : styles.unitBadgeCurrent
                  }`}
                >
                  {isComplete ? "✓ Done" : `Lesson ${index + 1}`}
                </span>

                <motion.button
                  type="button"
                  className={`${styles.node} ${
                    isComplete
                      ? styles.nodeComplete
                      : styles.nodeCurrent
                  }`}
                  onClick={() => handleNodeClick(unit.unit_id)}
                  aria-label={unit.title}
                  animate={isCurrent ? { scale: [1, 1.06, 1] } : undefined}
                  transition={
                    isCurrent
                      ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                      : undefined
                  }
                  whileTap={{ scale: 0.92 }}
                >
                  {isCurrent && (
                    <motion.span
                      className={styles.pulseRing}
                      animate={{ scale: [1, 1.22, 1], opacity: [0.55, 0, 0.55] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  <span className={styles.nodeIcon}>{unit.icon}</span>
                  {isComplete && (
                    <span className={styles.completeCheck}>✓</span>
                  )}
                </motion.button>

                <div className={styles.labelCard}>
                  <span className={styles.labelTitle}>{unit.title}</span>
                  {unit.description && (
                    <span className={styles.labelDesc}>{unit.description}</span>
                  )}
                </div>

                {isCurrent && (
                  <motion.button
                    type="button"
                    className={styles.startButton}
                    onClick={() => onUnitClick(unit.unit_id)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Start lesson →
                  </motion.button>
                )}

                {isComplete && (
                  <button
                    type="button"
                    className={styles.reviewButton}
                    onClick={() => onUnitClick(unit.unit_id)}
                  >
                    Review
                  </button>
                )}
              </div>
            );
          })}

          {onNewLesson && (
            <div
              className={styles.nodeWrapper}
              style={{
                left: `${(positions[units.length].x / containerWidth) * 100}%`,
                top: positions[units.length].y,
              }}
            >
              <span className={`${styles.unitBadge} ${styles.unitBadgeNew}`}>
                Custom
              </span>

              <motion.button
                type="button"
                className={styles.newLessonNode}
                onClick={onNewLesson}
                aria-label="Create new lesson"
                whileTap={{ scale: 0.92 }}
              >
                <span className={styles.plusIcon}>+</span>
              </motion.button>

              <div className={styles.labelCard}>
                <span className={styles.labelTitle}>New lesson</span>
                <span className={styles.labelDesc}>Type any topic</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
