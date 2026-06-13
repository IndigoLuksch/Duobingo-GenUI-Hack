"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RankedPhoto } from "@/lib/types";
import styles from "./PhotoSelector.module.css";

interface PhotoSelectorProps {
  placeName: string;
  address: string | null;
  photos: RankedPhoto[];
  onBack: () => void;
  onClose: () => void;
  onBuild: (photo: RankedPhoto) => void;
}

export default function PhotoSelector({
  placeName,
  address,
  photos,
  onBack,
  onClose,
  onBuild,
}: PhotoSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = photos[selectedIndex];

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.closeButton} onClick={onClose}>
        ✕ Close
      </button>

      <motion.div
        className={styles.panel}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h2 className={styles.heading}>Choose a photo of {placeName}</h2>
        {address && <p className={styles.address}>{address}</p>}

        <div className={styles.grid}>
          {photos.map((photo, index) => {
            const isSelected = index === selectedIndex;
            const isRecommended = index === 0;
            return (
              <button
                key={`${photo.photo_index}-${photo.url}`}
                type="button"
                className={`${styles.card} ${
                  isRecommended ? styles.cardRecommended : ""
                } ${isSelected ? styles.cardSelected : ""}`}
                onClick={() => setSelectedIndex(index)}
              >
                {isRecommended && (
                  <span className={styles.chip}>Recommended</span>
                )}
                {isSelected && <span className={styles.check}>✓</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.label}
                  className={styles.image}
                />
                <div className={styles.meta}>
                  <p className={styles.label}>{photo.label}</p>
                  <p className={styles.score}>
                    Score {(photo.score * 100).toFixed(0)}%
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.backButton} onClick={onBack}>
            ← Back
          </button>
          <button
            type="button"
            className={styles.buildButton}
            disabled={!selected}
            onClick={() => selected && onBuild(selected)}
          >
            Build this memory →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
