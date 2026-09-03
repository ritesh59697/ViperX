"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "../motion/useReducedMotion";

/**
 * A procedurally-rendered, animated ASCII viper — no WebGL. Each frame builds a
 * brightness field over a character grid: distance to a slithering serpent
 * centerline gives a shaded, scaled tube, mapped through a density ramp so the
 * glyphs themselves do the shading (exactly how a grayscale ASCII image reads).
 * A diamond head, two eyes, and a flicking forked tongue anchor it as a viper.
 */

// Dark -> light density ramp. The glyph shape carries the tone; text stays one color.
const RAMP = " .·:-=+*oO#%@";

type Size = "lg" | "sm";

const GRID: Record<Size, { cols: number; rows: number; fontClass: string }> = {
  lg: { cols: 104, rows: 34, fontClass: "text-[6px] sm:text-[8px] md:text-[10px] lg:text-[11px]" },
  sm: { cols: 30, rows: 14, fontClass: "text-[5px] sm:text-[6px]" },
};

// Character cells are taller than wide; correct distances so the viper isn't squashed.
const CELL_ASPECT = 0.52;

function rampChar(v: number): string {
  const i = Math.max(0, Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1))));
  return RAMP[i];
}

export function AsciiViper({
  size = "lg",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;

    const { cols, rows } = GRID[size];

    // Precompute the serpent centerline for a given time; body runs tail(0)->head(1).
    function render(time: number) {
      // Normalized coordinates: x in [0,1], y in [0,1].
      const SAMPLES = 72;
      const path: { x: number; y: number; r: number; t: number }[] = [];
      const phase = time * 0.55;
      for (let s = 0; s <= SAMPLES; s++) {
        const t = s / SAMPLES;
        // S-curve body crossing the frame, head raised on the right.
        const x = 0.1 + t * 0.8;
        const wave = Math.sin(t * Math.PI * 2.4 + phase) * 0.22 * (0.35 + t);
        const rise = -0.12 * t; // head lifts
        const y = 0.55 + wave + rise;
        // Radius: thin tail -> bulge toward the head.
        const headBulge = Math.pow(t, 1.6);
        const r = 0.012 + headBulge * 0.085;
        path.push({ x, y, r, t });
      }

      const head = path[path.length - 1];
      // Head direction, for orienting eyes/tongue.
      const prev = path[path.length - 6];
      const hdx = head.x - prev.x;
      const hdy = head.y - prev.y;
      const hlen = Math.hypot(hdx, hdy) || 1;
      const dirx = hdx / hlen;
      const diry = hdy / hlen;
      // Perpendicular (for eye offset).
      const perpx = -diry;
      const perpy = dirx;

      const eyeOffset = head.r * 0.42;
      const eye1 = { x: head.x - dirx * 0.02 + perpx * eyeOffset, y: head.y - diry * 0.02 + perpy * eyeOffset };
      const eye2 = { x: head.x - dirx * 0.02 - perpx * eyeOffset, y: head.y - diry * 0.02 - perpy * eyeOffset };

      // Tongue flick — length pulses, forks near the tip.
      const flick = Math.max(0, Math.sin(time * 3.1));
      const tongueLen = head.r * (1.4 + flick * 2.6);
      const tongueTip = { x: head.x + dirx * tongueLen, y: head.y + diry * tongueLen };

      let out = "";
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = col / (cols - 1);
          const py = row / (rows - 1);

          // Nearest point on the centerline (aspect-corrected distance).
          let best = Infinity;
          let bestR = 0.02;
          let bestT = 0;
          for (let i = 0; i < path.length; i++) {
            const p = path[i];
            const dx = (px - p.x);
            const dy = (py - p.y) * CELL_ASPECT;
            const d = dx * dx + dy * dy;
            if (d < best) {
              best = d;
              bestR = p.r;
              bestT = p.t;
            }
          }
          const dist = Math.sqrt(best);

          let v = 0;
          if (dist < bestR) {
            // Tube cross-section: bright ridge slightly off-center -> rounded metal.
            const edge = dist / bestR; // 0 center .. 1 rim
            const round = Math.cos(edge * 1.35);
            // Diamond-scale shimmer travelling head->tail.
            const scale = 0.5 + 0.5 * Math.sin(bestT * 46 - time * 2.2);
            v = 0.35 + round * 0.5 + scale * 0.18;
            // Head reads brighter/denser.
            if (bestT > 0.86) v += (bestT - 0.86) * 1.4;
          }

          // Eyes: force bright pinpoints.
          const de1 = Math.hypot(px - eye1.x, (py - eye1.y) * CELL_ASPECT);
          const de2 = Math.hypot(px - eye2.x, (py - eye2.y) * CELL_ASPECT);
          if (de1 < head.r * 0.22 || de2 < head.r * 0.22) v = 1;

          // Tongue: thin bright segment from head tip.
          if (flick > 0.15) {
            const tdx = tongueTip.x - head.x;
            const tdy = (tongueTip.y - head.y) * CELL_ASPECT;
            const tlen2 = tdx * tdx + tdy * tdy || 1;
            const rel = ((px - head.x) * tdx + (py - head.y) * CELL_ASPECT * tdy) / tlen2;
            if (rel > 0 && rel < 1) {
              const projx = head.x + rel * tdx;
              const projy = head.y + rel * (tongueTip.y - head.y);
              const dTongue = Math.hypot(px - projx, (py - projy) * CELL_ASPECT);
              if (dTongue < 0.006) v = Math.max(v, 0.85);
            }
          }

          // Faint living static in the negative space so the frame breathes.
          if (v <= 0) {
            const n = Math.sin(px * 40 + time) * Math.cos(py * 30 - time * 0.7);
            v = n > 0.92 ? 0.08 : 0;
          }

          out += rampChar(Math.min(1, v));
        }
        out += "\n";
      }
      el!.textContent = out;
    }

    if (reduced) {
      render(0.8);
      return;
    }

    let raf = 0;
    let last = 0;
    const start = performance.now();
    function loop(now: number) {
      if (now - last > 55) {
        render((now - start) / 1000);
        last = now;
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size, reduced]);

  return (
    <pre
      ref={preRef}
      aria-hidden
      className={`select-none font-mono leading-[0.95] tracking-[-0.02em] text-foreground ${GRID[size].fontClass} ${className}`}
      style={{ fontVariantLigatures: "none" }}
    />
  );
}
