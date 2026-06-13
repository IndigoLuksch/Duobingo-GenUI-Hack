"use client";

import { useEffect, useRef, useState } from "react";
import { GeminiLiveClient } from "@/lib/gemini-live";
import { startFrameCapture } from "@/lib/frame-capture";
import { useWorldStore } from "@/lib/store";
import { VocabItem, WordStrength, WorldCardData } from "@/lib/types";
import styles from "./GeminiLiveController.module.css";

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "show_word_card",
        description: "Display a vocabulary card overlaid on the 3D scene.",
        parameters: {
          type: "OBJECT",
          properties: {
            word: { type: "STRING" },
            translation: { type: "STRING" },
            gender: { type: "STRING", enum: ["m", "f", "n"] },
            example_sentence: { type: "STRING" },
            position_hint: {
              type: "STRING",
              enum: [
                "center",
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
              ],
            },
          },
          required: ["word", "translation", "position_hint"],
        },
      },
      {
        name: "update_strength",
        description: "Update the learner's SRS strength score for a word.",
        parameters: {
          type: "OBJECT",
          properties: {
            word_id: { type: "STRING" },
            result: { type: "STRING", enum: ["boost", "penalize"] },
          },
          required: ["word_id", "result"],
        },
      },
      {
        name: "save_to_deck",
        description: "Save a new word the learner discovered to their study deck.",
        parameters: {
          type: "OBJECT",
          properties: {
            word_id: { type: "STRING" },
            word: { type: "STRING" },
            translation: { type: "STRING" },
            gender: { type: "STRING" },
          },
          required: ["word_id", "word", "translation"],
        },
      },
    ],
  },
];

const PCM_WORKLET = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
`;

interface GeminiLiveControllerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  missedWordIds: string[];
  unitVocab: VocabItem[];
  wordStrengths: WordStrength[];
  unitTitle: string;
  extraContextLine?: string;
}

function buildSystemInstruction(
  unitTitle: string,
  missedWordIds: string[],
  unitVocab: VocabItem[],
  wordStrengths: WordStrength[],
  extraContextLine?: string
): string {
  const strengthMap = Object.fromEntries(
    wordStrengths.map((w) => [w.word_id, w.strength])
  );

  const missedLines =
    missedWordIds.length > 0
      ? missedWordIds
          .map((id) => {
            const vocab = unitVocab.find((v) => v.word_id === id);
            if (!vocab) return null;
            const strength = strengthMap[id] ?? 0.5;
            return `- ${vocab.fr} (${vocab.en}, ${vocab.gender ?? "n"}) — current strength: ${strength.toFixed(2)}`;
          })
          .filter(Boolean)
          .join("\n")
      : "- (none — the learner got everything right!)";

  const vocabLines = unitVocab
    .map((v) => `- ${v.fr} (${v.en}, ${v.gender ?? "n"})`)
    .join("\n");

  const memoryLine = extraContextLine ? `\n${extraContextLine}\n` : "";

  return `You are a warm, playful German language tutor. You are inside a 3D scene with the learner. You can SEE the scene through image frames that are sent to you periodically — these are screenshots of what the learner currently sees as they navigate the 3D environment.
${memoryLine}
CONTEXT:
The learner just completed a lesson on the theme "${unitTitle}".
They missed these words during the lesson — these are your PRIMARY targets:
${missedLines}

Full vocabulary for this scene (all of these objects should be visually present):
${vocabLines}

YOUR BEHAVIOR:
1. GREET the learner warmly in German when the session starts. Mention that you can see what they see.
2. SCAVENGER HUNT MODE: Ask the learner to find missed objects. Confirm when you see them centered in the frame. Call show_word_card AND update_strength on confirmation.
3. POINT-AND-ASK MODE: If the learner asks about something visible, identify it and teach.
4. LANGUAGE RULES: Speak primarily in German. Short responses (1-2 sentences). Use du.
5. VISUAL GROUNDING: Base responses on what you see in frames. Never claim to see something you're not confident about.
6. TOOL USAGE: Call show_word_card EVERY TIME you teach or confirm a word. Call update_strength EVERY TIME.`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function asRecord(args: unknown): Record<string, unknown> {
  if (args && typeof args === "object") {
    return args as Record<string, unknown>;
  }
  return {};
}

async function waitForCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  timeoutMs = 8000
): Promise<HTMLCanvasElement> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (canvasRef.current) return canvasRef.current;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error("Canvas not ready for frame capture");
}

async function handleToolCall(name: string, args: unknown): Promise<unknown> {
  const params = asRecord(args);

  if (name === "show_word_card") {
    const card: WorldCardData = {
      id: crypto.randomUUID(),
      word: String(params.word ?? ""),
      translation: String(params.translation ?? ""),
      gender: (params.gender as WorldCardData["gender"]) ?? null,
      example_sentence: params.example_sentence
        ? String(params.example_sentence)
        : null,
      authentic_sentence: null,
      authentic_source: null,
      position_hint:
        (params.position_hint as WorldCardData["position_hint"]) ?? "center",
      timestamp: Date.now(),
    };

    useWorldStore.getState().addCard(card);

    void fetch("/api/linkup/example-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: card.word,
        translation: card.translation,
      }),
    })
      .then((res) => res.json())
      .then((data: { sentence?: string | null; source?: string | null }) => {
        if (data.sentence) {
          useWorldStore.getState().updateCard(card.id, {
            authentic_sentence: data.sentence,
            authentic_source: data.source ?? null,
          });
        }
      })
      .catch(() => {});

    return { success: true };
  }

  if (name === "update_strength") {
    const word_id = String(params.word_id ?? "");
    const result = String(params.result ?? "");
    const res = await fetch("/api/redis/update-strength", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: "demo", word_id, result }),
    });
    const data = await res.json();
    useWorldStore.getState().updateStrength(
      word_id,
      data.new_strength,
      result === "boost"
    );
    return { success: true, new_strength: data.new_strength };
  }

  if (name === "save_to_deck") {
    await fetch("/api/redis/save-word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: "demo", ...params }),
    });
    return { success: true };
  }

  return { success: false, error: "Unknown tool" };
}

export default function GeminiLiveController({
  canvasRef,
  missedWordIds,
  unitVocab,
  wordStrengths,
  unitTitle,
  extraContextLine,
}: GeminiLiveControllerProps) {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [subtitleVisible, setSubtitleVisible] = useState(false);

  const mutedRef = useRef(muted);
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    let client: GeminiLiveClient | null = null;
    let stopFrames: (() => void) | null = null;
    let mediaStream: MediaStream | null = null;
    let inputContext: AudioContext | null = null;
    let playbackContext: AudioContext | null = null;
    let workletUrl: string | null = null;
    let nextPlayTime = 0;
    let disposed = false;

    const showSubtitle = (text: string) => {
      setSubtitle(text);
      setSubtitleVisible(true);
      if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
      subtitleTimerRef.current = setTimeout(() => {
        setSubtitleVisible(false);
      }, 5000);
    };

    async function startMicAndFrames() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        inputContext = new AudioContext({ sampleRate: 16000 });
        workletUrl = URL.createObjectURL(
          new Blob([PCM_WORKLET], { type: "application/javascript" })
        );
        await inputContext.audioWorklet.addModule(workletUrl);

        const source = inputContext.createMediaStreamSource(mediaStream);
        const worklet = new AudioWorkletNode(inputContext, "pcm-processor");
        worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          if (mutedRef.current || !client) return;
          client.sendAudio(arrayBufferToBase64(event.data));
        };
        source.connect(worklet);

        const canvas = await waitForCanvas(canvasRef);
        if (!disposed && client) {
          stopFrames = startFrameCapture(
            canvas,
            (base64) => client?.sendFrame(base64),
            1000
          );
        }
      } catch (error) {
        console.error("Gemini Live mic/capture failed:", error);
        if (!disposed) {
          setConnectionError(
            "Microphone access is required for voice tutoring. Check browser permissions."
          );
        }
      }
    }

    async function init() {
      const tokenRes = await fetch("/api/gemini-token");
      const { apiKey } = await tokenRes.json();
      if (!apiKey) {
        if (!disposed) {
          setConnectionError(
            "GEMINI_API_KEY is not configured on the server."
          );
        }
        return;
      }
      if (disposed) return;

      playbackContext = new AudioContext({ sampleRate: 24000 });

      const schedulePlayback = (pcmData: ArrayBuffer) => {
        if (!playbackContext || disposed) return;
        const int16 = new Int16Array(pcmData);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }
        const buffer = playbackContext.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(float32, 0);
        const source = playbackContext.createBufferSource();
        source.buffer = buffer;
        source.connect(playbackContext.destination);
        const now = playbackContext.currentTime;
        if (nextPlayTime < now) nextPlayTime = now;
        source.start(nextPlayTime);
        nextPlayTime += buffer.duration;
      };

      client = new GeminiLiveClient({
        apiKey,
        systemInstruction: buildSystemInstruction(
          unitTitle,
          missedWordIds,
          unitVocab,
          wordStrengths,
          extraContextLine
        ),
        tools: GEMINI_TOOLS,
        onReady: () => {
          if (!disposed) {
            setConnected(true);
            setConnectionError(null);
            void startMicAndFrames();
          }
        },
        onError: (message) => {
          if (!disposed) {
            setConnectionError(message);
            setConnected(false);
          }
        },
        onAudio: schedulePlayback,
        onText: showSubtitle,
        onToolCall: async (_id, name, args) => handleToolCall(name, args),
        onInterrupted: () => {
          if (playbackContext) nextPlayTime = playbackContext.currentTime;
        },
      });
      client.connect();
    }

    init().catch((error) => {
      console.error("Gemini Live init failed:", error);
      if (!disposed) {
        setConnectionError(
          error instanceof Error ? error.message : "Gemini Live init failed"
        );
      }
    });

    return () => {
      disposed = true;
      stopFrames?.();
      mediaStream?.getTracks().forEach((track) => track.stop());
      void inputContext?.close();
      void playbackContext?.close();
      client?.disconnect();
      if (workletUrl) URL.revokeObjectURL(workletUrl);
      if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
    };
  }, [canvasRef, missedWordIds, unitVocab, wordStrengths, unitTitle, extraContextLine]);

  return (
    <div className={styles.overlay}>
      <div className={styles.status}>
        <span
          className={`${styles.dot} ${
            connected ? "" : connectionError ? styles.dotError : styles.dotPending
          }`}
        />
        {connected
          ? "Gemini Live connected"
          : connectionError
            ? connectionError
            : "Connecting…"}
      </div>

      <button
        type="button"
        className={`${styles.micButton} ${muted ? styles.micMuted : ""}`}
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
      >
        {muted ? "🔇" : "🎤"}
      </button>

      {subtitle && (
        <div
          className={`${styles.subtitle} ${
            subtitleVisible ? "" : styles.subtitleHidden
          }`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
