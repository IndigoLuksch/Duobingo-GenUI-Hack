"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

interface PortalTransitionProps {
  active?: boolean;
  worldId: string;
  missedIds: string[];
  onComplete: () => void;
  children?: React.ReactNode;
}

const rootStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  overflow: "hidden",
};

const backgroundStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  transformOrigin: "center center",
};

const portalStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 2,
  background: "#fff",
  pointerEvents: "none",
};

function playRisingTone() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.9);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.9);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.95);
    oscillator.onended = () => {
      void ctx.close();
    };
  } catch (error) {
    console.warn("Portal sound failed:", error);
  }
}

export default function PortalTransition({
  active = true,
  worldId,
  missedIds,
  onComplete,
  children,
}: PortalTransitionProps) {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    playRisingTone();

    const navTimer = setTimeout(() => {
      const missed = missedIds.filter(Boolean).join(",");
      const query = missed ? `?missed=${missed}` : "";
      router.push(`/world/${worldId}${query}`);
      onComplete();
    }, 1200);

    return () => clearTimeout(navTimer);
  }, [active, worldId, missedIds, onComplete, router]);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <div style={rootStyle}>
      <motion.div
        style={backgroundStyle}
        initial={{ scale: 1, filter: "blur(0px)" }}
        animate={{ scale: 0.9, filter: "blur(8px)" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {children}
      </motion.div>

      <motion.div
        style={portalStyle}
        initial={{ clipPath: "circle(0% at 50% 50%)" }}
        animate={{ clipPath: "circle(150% at 50% 50%)" }}
        transition={{ delay: 0.3, duration: 0.9, ease: "easeInOut" }}
      />
    </div>
  );
}
