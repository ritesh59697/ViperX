"use client";

import { useState } from "react";
import { CheckGlyph, XGlyph } from "@/components/ui/StatusGlyphs";

export type ShowcaseStep = {
  n: string;
  tag: string;
  title: string;
  /** Terse mono label for the diagram caption — `// REGISTRY` etc. */
  caption: string;
  body: string;
  mock?: { label: string; value: string }[];
  permissions?: { label: string; allowed: boolean }[];
  progress?: { label: string; value: string };
};

/**
 * Split showcase: copy and a numbered index on the left, a crop-framed
 * line-art diagram on the right that swaps with the active step.
 *
 * Click-through only. This section used to pin itself below the header on wide,
 * tall viewports and advance its steps as you scrolled past — sticky
 * positioning over a section three viewports tall. It was removed along with
 * the rest of the landing page's scroll-driven motion: the section is now its
 * natural height and the steps change only when the reader picks one.
 */

/** Diagram tint per step. Deliberately narrow: the page runs one accent, so
 *  these shift warmth rather than introducing new hues. */
const GLOWS = [
  "radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--accent) 38%, transparent), transparent 68%)",
  "radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 68%)",
  "radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--positive) 30%, transparent), transparent 68%)",
];

/** Identity: a PDA derived from a seed — nested frames, one off-axis. */
function DiagramRegister() {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className="h-full w-full"
    >
      <rect x="100" y="100" width="200" height="200" />
      <path d="M200 60 L340 200 L200 340 L60 200 Z" />
      <rect x="70" y="70" width="260" height="260" strokeDasharray="10 8" />
      <rect x="160" y="160" width="80" height="80" strokeDasharray="4 6" />
    </svg>
  );
}

/** Bounded authority: an inner scope inscribed inside a wider one. */
function DiagramDelegate() {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className="h-full w-full"
    >
      <path d="M140 60 H260 L340 140 V260 L260 340 H140 L60 260 V140 Z" />
      <path d="M200 90 L295 145 V255 L200 310 L105 255 V145 Z" />
      <path
        d="M105 145 L295 255 M295 145 L105 255 M200 90 V310"
        strokeDasharray="8 7"
      />
      <circle cx="200" cy="200" r="34" strokeDasharray="4 6" />
    </svg>
  );
}

/** Track record: a closed orbit resolving around a core. */
function DiagramTrack() {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className="h-full w-full"
    >
      <circle cx="200" cy="200" r="110" />
      <ellipse
        cx="200"
        cy="200"
        rx="175"
        ry="66"
        transform="rotate(-18 200 200)"
      />
      <ellipse
        cx="200"
        cy="200"
        rx="175"
        ry="66"
        transform="rotate(18 200 200)"
        strokeDasharray="10 8"
      />
      <circle cx="200" cy="200" r="62" strokeDasharray="4 6" />
    </svg>
  );
}

const DIAGRAMS = [DiagramRegister, DiagramDelegate, DiagramTrack];

export function StepShowcase({ steps }: { steps: ShowcaseStep[] }) {
  const [active, setActive] = useState(0);
  const step = steps[active];

  return (
    <div className="grid gap-px lg:grid-cols-2 lg:gap-0">
      {/* --- LEFT: copy + index ------------------------------------------- */}
      <div className="flex flex-col lg:border-r lg:border-border lg:pr-12">
        <div className="min-h-[15rem]">
          <div className="flex items-center gap-4">
            <span className="font-mono text-2xl font-bold leading-none text-accent">
              {step.n}
            </span>
            <span className="bp-meta">{step.tag}</span>
          </div>

          <h3 className="bp-h3 mt-6 text-foreground">{step.title}</h3>
          <p className="bp-body mt-4 max-w-[46ch]">{step.body}</p>

          {step.mock && (
            <div className="mt-6 max-w-[22rem] space-y-2 border border-border p-3.5 font-mono text-xs">
              {step.mock.map((m) => (
                <div key={m.label} className="flex justify-between">
                  <span className="text-foreground-faint">{m.label}</span>
                  <span className="font-medium text-foreground">{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {step.permissions && (
            <div className="mt-6 max-w-[22rem] space-y-2 border border-border p-3.5 font-mono text-xs">
              {step.permissions.map((p) => (
                <div key={p.label} className="flex items-center gap-2">
                  <span
                    className={`inline-flex shrink-0 ${p.allowed ? "text-positive" : "text-negative"}`}
                  >
                    {p.allowed ? <CheckGlyph className="h-3.5 w-3.5" /> : <XGlyph className="h-3.5 w-3.5" />}
                  </span>
                  <span
                    className={
                      p.allowed
                        ? "text-foreground"
                        : "text-foreground-faint line-through"
                    }
                  >
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {step.progress && (
            <div className="mt-6 max-w-[22rem]">
              <div className="mb-2 flex justify-between font-mono text-xs">
                <span className="text-foreground-faint">
                  {step.progress.label}
                </span>
                <span className="font-medium text-foreground">
                  {step.progress.value}
                </span>
              </div>
              <div className="h-1 w-full bg-background-muted">
                <div className="h-full bg-accent" style={{ width: "74%" }} />
              </div>
            </div>
          )}
        </div>

        {/* Numbered index. The rule keeps its length; only weight changes, so
              the column doesn't reflow as the active row moves. */}
        <ul className="mt-12 border-t border-border pt-8">
          {steps.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => setActive(i)}
                data-active={i === active ? "true" : undefined}
                className="bp-step group flex w-full items-center gap-5 py-3.5 text-left"
                aria-current={i === active ? "step" : undefined}
              >
                <span className="bp-step-n font-mono text-xs">{i + 1}</span>
                <span
                  className="bp-step-rule h-px w-16 shrink-0 sm:w-28"
                  aria-hidden="true"
                />
                <span className="bp-step-label font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
                  {s.caption}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* --- RIGHT: crop-framed diagram ------------------------------------ */}
      {/* The pointer position is written straight to CSS custom properties
            rather than held in state — this fires on every mousemove, and a
            re-render per frame would be wasted work for something only CSS
            consumes. */}
      <div
        className="bp-dots bp-dots-live relative min-h-[26rem] lg:min-h-[34rem]"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.removeProperty("--mx");
          e.currentTarget.style.removeProperty("--my");
        }}
      >
        <span className="bp-meta absolute right-5 top-5 z-10">
          {`// ${String(active + 1).padStart(3, "0")}`}
        </span>

        {/* The absolute positioning lives on this wrapper, not on `.bp-crop`.
              `.bp-crop` sets `position: relative` at the same specificity as
              Tailwind's `absolute` and is defined later, so it wins — putting
              both on one element silently collapses the frame to height 0. */}
        <div className="absolute inset-8 sm:inset-12">
          <div className="bp-crop h-full w-full">
            {/* Calm backdrop: mutes the global dither inside the frame so the
                  line-art reads on clean space (the Monad look) instead of
                  competing with the noise running through the section. */}
            <div
              className="absolute inset-0 bg-background/72 backdrop-blur-md"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 transition-[background-image] duration-500"
              style={{ backgroundImage: GLOWS[active] }}
              aria-hidden="true"
            />
            {DIAGRAMS.map((D, i) => (
              <div
                key={i}
                aria-hidden={i !== active}
                className="bp-figure absolute inset-0 flex items-center justify-center text-foreground/80"
                data-active={i === active ? "true" : undefined}
              >
                <D />
              </div>
            ))}
          </div>
        </div>

        <span className="bp-meta absolute bottom-5 left-5 z-10">
          {`// ${step.caption}`}
        </span>
      </div>
    </div>
  );
}
