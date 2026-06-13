"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import PhotoSelector from "@/components/PhotoSelector";
import { RankedPhoto } from "@/lib/types";
import styles from "./MemoryPlaceSearch.module.css";

type Step = "search" | "loading" | "photos" | "building";

interface MemoryPlaceSearchProps {
  unitId: string;
  unitTitle: string;
  onSkip: () => void;
  onComplete: (placeId: string) => void;
}

interface PlaceSelection {
  place_id: string;
  place_name: string;
}

interface PlaceSuggestion {
  place_id: string;
  place_name: string;
  description: string;
}

export default function MemoryPlaceSearch({
  unitId,
  unitTitle,
  onSkip,
  onComplete,
}: MemoryPlaceSearchProps) {
  const placeTheme = unitTitle
    .replace(/^In the /i, "")
    .replace(/^At the /i, "")
    .toLowerCase();
  const [step, setStep] = useState<Step>("search");
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [photos, setPhotos] = useState<RankedPhoto[]>([]);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== "search" || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/memory-place/autocomplete?input=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        if (data.error) {
          setError(data.error);
        } else {
          setError(null);
        }
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
  }, [query, step]);

  const handlePlaceSelected = async (selection: PlaceSelection) => {
    setPlace(selection);
    setQuery(selection.place_name);
    setSuggestions([]);
    setStep("loading");
    setError(null);

    try {
      const res = await fetch("/api/memory-place/select-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch photos");
      }
      setAddress(data.address ?? null);
      setPhotos(data.ranked_photos ?? []);
      setStep("photos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("search");
    }
  };

  const handleBuild = async (photo: RankedPhoto) => {
    if (!place) return;
    setStep("building");
    setError(null);

    try {
      const res = await fetch("/api/memory-place/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: "demo",
          place_id: place.place_id,
          place_name: place.place_name,
          photo_url: photo.url,
          unit_id: unitId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start generation");
      }
      // Generation started in background — navigate to the lesson immediately
      onComplete(place.place_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed");
      setStep("photos");
    }
  };

  if (step === "photos" && place) {
    return (
      <PhotoSelector
        placeName={place.place_name}
        address={address}
        photos={photos}
        onBack={() => setStep("search")}
        onClose={onSkip}
        onBuild={handleBuild}
      />
    );
  }

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.closeButton} onClick={onSkip}>
        Skip →
      </button>

      <motion.div
        className={styles.modal}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <h1 className={styles.heading}>
          What&apos;s your favorite {placeTheme}?
        </h1>
        <p className={styles.subheading}>
          Find it here — we&apos;ll build a 3D world from it so you can
          practice French in a place you actually know.
        </p>

        {step === "search" && (
          <div className={styles.searchBox}>
            <input
              className={styles.input}
              type="text"
              placeholder={`Search for a ${placeTheme}…`}
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && suggestions.length === 0 && !error && (
              <p className={styles.searching}>Searching…</p>
            )}
            {!searching && suggestions.length === 0 && query.trim().length >= 2 && !error && (
              <p className={styles.searching}>No places found — try a different search.</p>
            )}
            {suggestions.length > 0 && (
              <ul className={styles.suggestions}>
                {suggestions.map((suggestion) => (
                  <li key={suggestion.place_id}>
                    <button
                      type="button"
                      className={styles.suggestionButton}
                      onClick={() =>
                        handlePlaceSelected({
                          place_id: suggestion.place_id,
                          place_name: suggestion.place_name,
                        })
                      }
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
            <button
              type="button"
              className={styles.skipInline}
              onClick={onSkip}
            >
              Skip, just start the lesson →
            </button>
          </div>
        )}

        {step === "loading" && (
          <p className={styles.loading}>Finding the best photos…</p>
        )}

        {step === "building" && (
          <p className={styles.loading}>
            Starting your world build… taking you to the lesson!
          </p>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </motion.div>
    </div>
  );
}
