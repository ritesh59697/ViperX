"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\|<>=+*#@%&$";

function randGlyph(): string {
  return GLYPHS[(Math.random() * GLYPHS.length) | 0];
}

/**
 * The "unscramble" decode effect — each character resolves from random glyphs
 * to its final value, left to right. On-theme for a terminal, and the signature
 * motion from the Rysa reference. Falls back to plain text under reduced motion.
 */
export function ScrambleText({
  text,
  className = "",
  speedMs = 26,
  startDelayMs = 120,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  speedMs?: number;
  startDelayMs?: number;
  as?: "span" | "h1" | "h2" | "h3" | "p";
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(text);
  const frame = useRef(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(text);
      return;
    }

    let raf = 0;
    let revealed = 0;
    let tick = 0;
    frame.current = 0;

    const startTimer = window.setTimeout(function run() {
      function step() {
        tick += 1;
        // Reveal one more locked character every couple of frames.
        if (tick % 2 === 0 && revealed < text.length) revealed += 1;

        let out = "";
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (ch === " ") {
            out += " ";
          } else if (i < revealed) {
            out += ch;
          } else {
            out += randGlyph();
          }
        }
        setDisplay(out);

        if (revealed < text.length) {
          raf = window.setTimeout(step, speedMs) as unknown as number;
        } else {
          setDisplay(text);
        }
      }
      step();
    }, startDelayMs);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(raf);
    };
  }, [text, speedMs, startDelayMs, reduced]);

  return <Tag className={className}>{display}</Tag>;
}
