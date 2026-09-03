"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "./useReducedMotion";

/** Path-draw checkmark burst — this pass's Motion/SVG stand-in for a Lottie
 * success animation (see plan §6: no real Lottie assets sourced yet). */
export function SuccessCheck({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <svg viewBox="0 0 52 52" className={className} aria-hidden>
      <motion.circle
        cx="26"
        cy="26"
        r="23"
        fill="none"
        stroke="var(--positive)"
        strokeWidth="2.5"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <motion.path
        d="M14 27l7 7 17-17"
        fill="none"
        stroke="var(--positive)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: reduced ? 0 : 0.35, ease: "easeOut" }}
      />
    </svg>
  );
}
