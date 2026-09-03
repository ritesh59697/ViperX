"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

export function TypewriterText({
  text,
  className = "",
  speedMs = 35,
  startDelayMs = 200,
}: {
  text: string;
  className?: string;
  speedMs?: number;
  startDelayMs?: number;
}) {
  const reduced = useReducedMotion();
  const [visibleChars, setVisibleChars] = useState(reduced ? text.length : 0);
  const [done, setDone] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setVisibleChars(text.length);
      setDone(true);
      return;
    }

    setVisibleChars(0);
    setDone(false);

    let cancelled = false;
    let i = 0;

    const startTimer = window.setTimeout(function tick() {
      if (cancelled) return;
      i += 1;
      setVisibleChars(i);
      if (i >= text.length) {
        setDone(true);
        return;
      }
      window.setTimeout(tick, speedMs);
    }, startDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [text, speedMs, startDelayMs, reduced]);

  return (
    <span className={className}>
      {text.slice(0, visibleChars)}
      <span
        aria-hidden
        className={`ml-0.5 inline-block w-[0.5ch] border-r-2 border-current ${
          reduced ? "" : done ? "caret-blink" : "opacity-100"
        }`}
      />
    </span>
  );
}
