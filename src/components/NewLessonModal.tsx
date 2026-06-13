"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import AppLogo from "@/components/ui/AppLogo";
import LoadingState from "@/components/ui/LoadingState";
import { useCourse } from "@/lib/course-context";
import { findUnitById } from "@/lib/course-data";
import { CourseId } from "@/lib/courses";
import { Unit } from "@/lib/types";
import styles from "./NewLessonModal.module.css";

interface NewLessonModalProps {
  courseId: CourseId;
  onClose: () => void;
  onCreated: (unit: Unit) => void;
}

export default function NewLessonModal({
  courseId,
  onClose,
  onCreated,
}: NewLessonModalProps) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/lesson/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed, courseId }),
      });

      const data = (await res.json()) as { unit?: Unit; error?: string };

      if (!res.ok || !data.unit) {
        setError(data.error ?? "Could not generate lesson. Try again.");
        setLoading(false);
        return;
      }

      onCreated(data.unit);
    } catch {
      setError("Could not reach the server. Check your connection.");
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="new-lesson-heading"
      >
        <div className={styles.logoWrap}>
          <AppLogo height={24} />
        </div>

        <h2 id="new-lesson-heading" className={styles.heading}>
          Create a lesson
        </h2>
        <p className={styles.subheading}>
          Type a topic — like <strong>park</strong>, <strong>airport</strong>, or{" "}
          <strong>bakery</strong> — and we&apos;ll search the web for real vocabulary
          and example sentences.
        </p>

        {loading ? (
          <LoadingState message="Searching the web and building your lesson…" />
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              className={styles.input}
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. park"
              autoFocus
              maxLength={80}
              aria-label="Lesson topic"
            />

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.createButton}
                disabled={!topic.trim()}
              >
                Generate lesson
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
