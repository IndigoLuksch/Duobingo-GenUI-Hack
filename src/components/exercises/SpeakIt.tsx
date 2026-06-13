"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCourse } from "@/lib/course-context";
import { CourseId } from "@/lib/courses";
import { SpeakItExercise } from "@/lib/types";
import styles from "./exercises.module.css";

const SPEECH_LANG: Record<CourseId, string> = {
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
};

interface Props {
  exercise: SpeakItExercise;
  onSubmit: (id: string, response: { spoken: string }) => void;
  feedbackState: "idle" | "correct" | "wrong";
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {
    results: { [index: number]: { [index: number]: { transcript: string } } };
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function SpeakIt({ exercise, onSubmit, feedbackState }: Props) {
  const { courseId } = useCourse();
  const speechLang = SPEECH_LANG[courseId];
  const [submitted, setSubmitted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [fallbackText, setFallbackText] = useState("");

  useEffect(() => {
    setSubmitted(false);
    setTranscript("");
    setFallbackText("");
    setIsRecording(false);

    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    setSpeechAvailable(
      !!(win.SpeechRecognition || win.webkitSpeechRecognition)
    );
  }, [exercise.exercise_id]);

  const speakTarget = () => {
    const utterance = new SpeechSynthesisUtterance(exercise.target_text);
    utterance.lang = speechLang;
    window.speechSynthesis.speak(utterance);
  };

  const submitSpoken = (spoken: string) => {
    if (submitted || !spoken.trim()) return;
    setTranscript(spoken);
    setSubmitted(true);
    onSubmit(exercise.exercise_id, { spoken });
  };

  const startRecording = () => {
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Recognition || submitted) return;

    const recognition = new Recognition();
    recognition.lang = speechLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      submitSpoken(spoken);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    setIsRecording(true);
    recognition.start();
  };

  return (
    <div className={styles.exercise}>
      <p className={styles.speakTarget}>{exercise.target_text}</p>

      <button
        type="button"
        className={styles.audioBtn}
        onClick={speakTarget}
        aria-label="Listen to pronunciation"
      >
        🔊
      </button>

      {speechAvailable ? (
        <button
          type="button"
          className={`${styles.micBtn} ${isRecording ? styles.micRecording : ""}`}
          onClick={startRecording}
          disabled={submitted}
          aria-label="Record speech"
        >
          🎤
        </button>
      ) : (
        <form
          className={styles.fallbackForm}
          onSubmit={(e) => {
            e.preventDefault();
            submitSpoken(fallbackText);
          }}
        >
          <input
            className={styles.fallbackInput}
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            placeholder="Type what you said..."
            disabled={submitted}
          />
          <button
            type="submit"
            className={styles.fallbackSubmit}
            disabled={submitted || !fallbackText.trim()}
          >
            Submit
          </button>
        </form>
      )}

      {transcript && (
        <p className={styles.transcript}>You said: {transcript}</p>
      )}

      {feedbackState === "correct" && (
        <motion.p
          className={styles.feedbackCorrect}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          ✓ Bien joué !
        </motion.p>
      )}

      {feedbackState === "wrong" && transcript && (
        <div className={styles.feedbackWrong}>
          <span className={styles.feedbackTarget}>{exercise.target_text}</span>
          <span className={styles.feedbackSpoken}>{transcript}</span>
        </div>
      )}
    </div>
  );
}
