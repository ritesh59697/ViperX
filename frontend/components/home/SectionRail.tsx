"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/motion/useReducedMotion";

export type RailSection = { id: string; label: string };

/**
 * Fixed right-edge section index: a tick per section, the active one drawn
 * long and in the accent colour, with its label shown.
 *
 * Active state is computed from a plain scroll listener rather than an
 * IntersectionObserver. A rail is a *position* readout, not an enter/exit
 * event — with sections of wildly different heights, "which one owns the
 * viewport right now" is a question about offsets, and IO's threshold model
 * answers a different question badly (two sections can both be intersecting,
 * and neither may be the one you're reading). The handler is O(sections) and
 * runs against cached tops that are only re-measured on resize.
 *
 * This replaces `.bp-rails`' right-hand decorative rail rather than sitting
 * next to it — two columns of ticks down the same margin read as clutter. The
 * left gutter stays decorative; the right one navigates.
 */
export function SectionRail({ sections }: { sections: RailSection[] }) {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  // Measured section tops, in document coordinates. Recomputed on resize only.
  const tops = useRef<number[]>([]);

  useEffect(() => {
    const measure = () => {
      tops.current = sections.map((s) => {
        const el = document.getElementById(s.id);
        return el ? el.getBoundingClientRect().top + window.scrollY : Infinity;
      });
    };

    const onScroll = () => {
      // A section is "active" once its top passes the upper third of the
      // viewport — the point where you're actually reading it, rather than
      // when its first pixel appears at the bottom edge.
      const line = window.scrollY + window.innerHeight * 0.34;
      let next = 0;
      for (let i = 0; i < tops.current.length; i++) {
        if (tops.current[i] <= line) next = i;
      }
      setActive(next);
    };

    measure();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    // Late-loading fonts and images shift section tops after first paint.
    const settle = window.setTimeout(() => {
      measure();
      onScroll();
    }, 600);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      window.clearTimeout(settle);
    };
  }, [sections]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <nav className="bp-rail" aria-label="Page sections">
      {sections.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => go(s.id)}
          className="bp-rail-item"
          data-active={i === active ? "true" : undefined}
          aria-current={i === active ? "true" : undefined}
        >
          <span className="bp-rail-label">{s.label}</span>
          <span className="bp-rail-tick" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
