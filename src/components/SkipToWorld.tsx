"use client";

import { useRouter } from "next/navigation";
import styles from "./SkipToWorld.module.css";

const WASABI_WORLD_ID = "wasabi";

export default function SkipToWorld() {
  const router = useRouter();

  return (
    <section className={styles.bar} aria-label="Skip straight to 3D world">
      <p className={styles.heading}>Skip straight to 3D world</p>
      <div className={styles.venues}>
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
  );
}
