"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "./useReducedMotion";

/** Pulsing dot — Motion/SVG stand-in for a Lottie "live data" micro-animation. */
export function LivePulse({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`}>
      {!reduced && (
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-positive"
          animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
    </span>
  );
}
