"use client";

import Lottie from "lottie-react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "../motion/useReducedMotion";

/**
 * Thin lottie-react wrapper, ready for real Lottie JSON assets once they're
 * sourced (see plan §6) — not wired up to any asset yet. `animationPath` is a
 * public/ path (e.g. "/lottie/success.json"), fetched client-side.
 */
export function LottiePlayer({
  animationPath,
  loop = false,
  className = "",
}: {
  animationPath: string;
  loop?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(animationPath)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        /* missing asset — render nothing rather than crash the page */
      });
    return () => {
      cancelled = true;
    };
  }, [animationPath]);

  if (!animationData) return null;

  return (
    <Lottie
      animationData={animationData}
      loop={!reduced && loop}
      autoplay={!reduced}
      className={className}
    />
  );
}
