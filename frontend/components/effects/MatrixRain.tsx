"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "../motion/useReducedMotion";

const GLYPHS = "01アイウエオカキクケコサシスセソ";
const FONT_SIZE = 14;

/**
 * A faint (4-6% opacity) falling-glyph watermark, scoped to whatever
 * container it's placed in rather than the full viewport — a light-theme
 * texture, not a dark matrix panel.
 */
export function MatrixRain({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    let width = 0;
    let height = 0;
    let columns = 0;
    let drops: number[] = [];

    function resize() {
      const rect = parent!.getBoundingClientRect();
      width = canvas!.width = rect.width;
      height = canvas!.height = rect.height;
      columns = Math.ceil(width / FONT_SIZE);
      drops = new Array(columns).fill(0).map(() => Math.random() * -height);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(parent);

    function drawFrame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${FONT_SIZE}px var(--font-mono, monospace)`;
      ctx.fillStyle = "currentColor";

      for (let i = 0; i < columns; i++) {
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        ctx.fillText(glyph, i * FONT_SIZE, drops[i]);
        drops[i] += FONT_SIZE;
        if (drops[i] > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }
    }

    if (reduced) {
      drawFrame();
      return () => resizeObserver.disconnect();
    }

    let raf = 0;
    let lastTick = 0;
    function loop(t: number) {
      if (t - lastTick > 60) {
        drawFrame();
        lastTick = t;
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 text-foreground opacity-[0.05] ${className}`}
    />
  );
}
