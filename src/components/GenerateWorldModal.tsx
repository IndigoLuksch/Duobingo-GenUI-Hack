"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AppLogo from "@/components/ui/AppLogo";
import { CourseId } from "@/lib/courses";
import styles from "./GenerateWorldModal.module.css";

interface GenerateWorldModalProps {
  courseId: CourseId;
  onClose: () => void;
}

interface PlaceSuggestion {
  place_id: string;
  place_name: string;
  description: string;
}

export default function GenerateWorldModal({
  courseId,
  onClose,
}: GenerateWorldModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ input: query });
        const res = await fetch(
          `/api/memory-place/autocomplete?${params.toString()}`
        );
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setError(data.error ?? null);
      } catch {
        setSuggestions([]);
        setError("Could not reach place search. Check your connection.");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handlePlaceSelected = async (selection: PlaceSuggestion) => {
    setQuery(selection.place_name);
    setSuggestions([]);
    setBuilding(true);
    setError(null);

    try {
      const res = await fetch("/api/custom-world/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: "demo",
          place_id: selection.place_id,
          place_name: selection.place_name,
          course_id: courseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate world");
      }
      router.push(data.url ?? `/memory/${encodeURIComponent(data.place_id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBuilding(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.closeButton}
        onClick={onClose}
        disabled={building}
      >
        Cancel
      </button>

      <motion.div
        className={styles.modal}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className={styles.logoWrap}>
          <AppLogo height={22} />
        </div>
        <h1 className={styles.heading}>Generate your own world</h1>
        <p className={styles.subheading}>
          Pick any location — we&apos;ll drop you into Google Street View right
          away, then build a full 3D world in the background.
        </p>

        {!building && (
          <div className={styles.searchBox}>
            <input
              className={styles.input}
              type="text"
              placeholder="Search for a place…"
              autoComplete="off"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && suggestions.length === 0 && !error && (
              <p className={styles.searching}>Searching…</p>
            )}
            {!searching &&
              suggestions.length === 0 &&
              query.trim().length >= 2 &&
              !error && (
                <p className={styles.searching}>
                  No places found — try a different search.
                </p>
              )}
            {suggestions.length > 0 && (
              <ul className={styles.suggestions}>
                {suggestions.map((suggestion) => (
                  <li key={suggestion.place_id}>
                    <button
                      type="button"
                      className={styles.suggestionButton}
                      onClick={() => handlePlaceSelected(suggestion)}
                    >
                      <span className={styles.suggestionMain}>
                        {suggestion.place_name}
                      </span>
                      <span className={styles.suggestionSub}>
                        {suggestion.description}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {building && (
          <p className={styles.loading}>
            Fetching Street View and starting your world…
          </p>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </motion.div>
    </div>
  );
}
