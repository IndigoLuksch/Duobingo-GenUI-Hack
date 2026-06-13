"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWorldStore } from "@/lib/store";
import styles from "./WorldHUD.module.css";

function strengthColor(strength: number): string {
  if (strength < 0.3) return "#ef4444";
  if (strength < 0.6) return "#f97316";
  return "#22c55e";
}

export default function WorldHUD() {
  const strengthUpdates = useWorldStore((s) => s.strengthUpdates);
  const boostedWordIds = useWorldStore((s) => s.boostedWordIds);
  const missedWordIds = useWorldStore((s) => s.missedWordIds);
  const [showHeart, setShowHeart] = useState(true);

  const foundCount = boostedWordIds.length;
  const totalCount = missedWordIds.length;
  const updatedWords = Object.entries(strengthUpdates);

  useEffect(() => {
    const timer = setTimeout(() => setShowHeart(false), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div className={styles.panel}>
        <p className={styles.counter}>
          {foundCount} / {totalCount} mots trouvés
        </p>

        {updatedWords.length > 0 && (
          <div className={styles.bars}>
            {updatedWords.map(([wordId, strength]) => (
              <div key={wordId} className={styles.barRow}>
                <span className={styles.label}>{wordId}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${Math.round(strength * 100)}%`,
                      backgroundColor: strengthColor(strength),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showHeart && (
          <motion.div
            className={styles.heartPopup}
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -36, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            +❤️
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
