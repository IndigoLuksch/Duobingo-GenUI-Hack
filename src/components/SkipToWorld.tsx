"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrebuiltWorldKey } from "@/lib/prebuilt-worlds";
import styles from "./SkipToWorld.module.css";

const VENUES: { key: PrebuiltWorldKey; label: string; emoji: string }[] = [
  { key: "station", label: "King's Cross Station", emoji: "🚂" },
  { key: "pret", label: "Pret near King's Cross", emoji: "☕" },
  { key: "bakery", label: "GAIL's Bakery", emoji: "🥖" },
];

export default function SkipToWorld() {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<PrebuiltWorldKey | null>(null);

  const handleEnter = async (key: PrebuiltWorldKey) => {
    if (loadingKey) return;
    setLoadingKey(key);
    try {
      const res = await fetch("/api/prebuilt-worlds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not load world");
      }
      router.push(data.url);
    } catch {
      const fallback: Record<PrebuiltWorldKey, string> = {
        station: "/world/gare_fr",
        pret: "/world/cafe_fr",
        bakery: "/world/boulangerie_fr",
      };
      router.push(fallback[key]);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <section className={styles.bar} aria-label="Skip straight to 3D world">
      <p className={styles.heading}>Skip straight to 3D world</p>
      <div className={styles.venues}>
        {VENUES.map((venue) => (
          <button
            key={venue.key}
            type="button"
            className={styles.venueButton}
            onClick={() => handleEnter(venue.key)}
            disabled={loadingKey !== null}
          >
            <span className={styles.venueEmoji} aria-hidden>
              {venue.emoji}
            </span>
            <span className={styles.venueLabel}>
              {loadingKey === venue.key ? "Loading…" : venue.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
