"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GenerateWorldModal from "@/components/GenerateWorldModal";
import { useCourse } from "@/lib/course-context";
import styles from "./SkipToWorld.module.css";

const WASABI_WORLD_ID = "wasabi";

export default function SkipToWorld() {
  const router = useRouter();
  const { courseId } = useCourse();
  const [showGenerate, setShowGenerate] = useState(false);

  return (
    <>
      <section className={styles.bar} aria-label="Quick world access">
        <p className={styles.heading}>Jump into a world</p>
        <div className={styles.venues}>
          <button
            type="button"
            className={styles.venueButton}
            onClick={() => setShowGenerate(true)}
          >
            <span className={styles.venueEmoji} aria-hidden>
              🌍
            </span>
            <span className={styles.venueLabel}>Generate your world</span>
          </button>
          <button
            type="button"
            className={styles.venueButton}
            onClick={() => router.push(`/world/${WASABI_WORLD_ID}`)}
          >
            <span className={styles.venueEmoji} aria-hidden>
              🍣
            </span>
            <span className={styles.venueLabel}>Wasabi Sushi & Bento</span>
          </button>
        </div>
      </section>

      {showGenerate && (
        <GenerateWorldModal
          courseId={courseId}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </>
  );
}
