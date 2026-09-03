"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\|<>=+*#@%&$";

function randGlyph(): string {
  return GLYPHS[(Math.random() * GLYPHS.length) | 0];
}

/**
 * Scrambles a label into cipher junk on hover, then decrypts it left to right.
 *
 * Distinct from [ScrambleText], which plays once on mount — this is triggered
 * by the parent's hover and re-runs each time. Both share the glyph set so the
 * two effects read as the same mechanism.
 *
 * Width is safe to leave unconstrained here because every caller sets it in
 * the monospace face: a scrambled string of equal length occupies identical
 * space, so the label can't jitter mid-decode the way it would in a
 * proportional font.
 */
export function ScrambleOnHover({
  text,
  active,
  speedMs = 28,
  className = "",
}: {
  /** Label to render at rest and decrypt back to. */
  text: string;
  /** Hover state, owned by the parent so it can be driven by a `group`. */
  active: boolean;
  speedMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(text);
  const timer = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (reduced || !active) {
      stop();
      setDisplay(text);
      return;
    }

    let revealed = 0;
    let tick = 0;

    const step = () => {
      tick += 1;
      if (tick % 2 === 0 && revealed < text.length) revealed += 1;

      let out = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        // Spaces stay put so word boundaries never move during the scramble.
        if (ch === " ") out += " ";
        else if (i < revealed) out += ch;
        else out += randGlyph();
      }
      setDisplay(out);

      if (revealed < text.length) {
        timer.current = window.setTimeout(step, speedMs);
      } else {
        setDisplay(text);
        timer.current = undefined;
      }
    };

    step();
    return stop;
  }, [active, text, speedMs, reduced, stop]);

  useEffect(() => stop, [stop]);

  return <span className={className}>{display}</span>;
}
