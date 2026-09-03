"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Pins its section and translates a horizontal track as the user scrolls
 * vertically through it — the Thayon "track record" mechanic. Only makes
 * sense for sequential/narrative content (this phase, then this phase); for
 * side-by-side comparison content a plain grid stays easier to scan, so this
 * is deliberately not the default card layout everywhere.
 *
 * Falls back to a plain CSS grid under prefers-reduced-motion — no pinning,
 * no scroll hijacking, just every item visible at once.
 */
export function ScrollCarousel({
  children,
  className = "",
  fallbackClassName = "grid gap-6",
  pinOffsetClassName = "top-28",
  vhPerItem = 65,
}: {
  children: ReactNode[];
  className?: string;
  /** Layout used verbatim under prefers-reduced-motion or a single child — bring your own responsive grid classes. */
  fallbackClassName?: string;
  /** Tailwind top-* class for the sticky viewport, to clear your fixed header. */
  pinOffsetClassName?: string;
  /** Scroll distance per item, in vh. Lower = snappier, higher = slower scrub. */
  vhPerItem?: number;
}) {
  const reduced = useReducedMotion();
  const targetRef = useRef<HTMLDivElement>(null);
  const count = children.length;

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", `-${((count - 1) / count) * 100}%`]);

  if (reduced || count <= 1) {
    return <div className={fallbackClassName}>{children}</div>;
  }

  return (
    <div ref={targetRef} className="relative" style={{ height: `${count * vhPerItem}vh` }}>
      <div className={`sticky ${pinOffsetClassName} overflow-hidden`}>
        <motion.div className={`flex ${className}`} style={{ x, width: `${count * 100}%` }}>
          {children.map((child, i) => (
            <div key={i} style={{ width: `${100 / count}%` }} className="shrink-0 px-3">
              {child}
            </div>
          ))}
        </motion.div>

        <div className="mx-auto mt-6 h-1 w-40 max-w-[60%] overflow-hidden rounded-full bg-background-muted">
          <motion.div className="h-full rounded-full bg-accent" style={{ scaleX: scrollYProgress, originX: 0 }} />
        </div>
      </div>
    </div>
  );
}
