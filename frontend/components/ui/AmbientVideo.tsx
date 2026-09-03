"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { useReducedMotion } from "@/components/motion/useReducedMotion";

type MaskDirection = "top" | "bottom" | "radial";

const MASKS: Record<MaskDirection, string> = {
  top: "linear-gradient(to bottom, black 0%, black 25%, transparent 88%)",
  bottom: "linear-gradient(to top, black 0%, black 25%, transparent 88%)",
  radial: "radial-gradient(ellipse 65% 65% at 50% 50%, black 0%, transparent 78%)",
};

/** Softens the left/right edges, which a purely vertical mask leaves razor-sharp. */
const SIDE_FEATHER = "linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)";

export type AmbientSource = {
  /** Looping, audio-less mp4 in /public/video. */
  src: string;
  /** First-frame still, shown before the video is ready and as the reduced-motion fallback. */
  poster: string;
  opacity?: number;
};

/**
 * The moving counterpart to <AmbientWash>: a decorative looping video faded
 * into the surrounding background via the same CSS masks, so it reads as
 * atmosphere rather than as an embedded player.
 *
 * Three things it deliberately handles, none of which a bare <video> would:
 *  - **Per-theme sources.** The site's palette flips between a near-white and a
 *    near-black background, and no single clip suits both. Only the active
 *    theme's file is ever rendered, so the other one is never downloaded.
 *  - **Reduced motion.** Falls back to the poster still. CSS alone can't do
 *    this: a hidden <video> keeps playing (and streaming) regardless.
 *  - **Off-screen cost.** Non-`priority` instances don't mount their <video>
 *    until they're near the viewport, so mid-page washes cost nothing on load.
 */
export function AmbientVideo({
  light,
  dark,
  className = "",
  mask = "top",
  feather = false,
  priority = false,
  sizes = "100vw",
}: {
  light: AmbientSource;
  /** Defaults to `light` when the clip works against either palette. */
  dark?: AmbientSource;
  className?: string;
  mask?: MaskDirection;
  /**
   * Fade the left/right edges too. Needed whenever the wash is narrower than
   * the page, where a vertical-only mask leaves it looking like a pasted
   * rectangle. Pointless on `radial`, which already fades every edge.
   */
  feather?: boolean;
  /** Skip the near-viewport gate and start loading immediately (above-the-fold only). */
  priority?: boolean;
  sizes?: string;
}) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(priority);

  // The poster carries the first paint; the video only ever swaps in after
  // hydration, which also keeps the theme/reduced-motion reads out of SSR.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (priority || inView) return;
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, inView]);

  const source = theme === "dark" ? (dark ?? light) : light;
  const opacity = source.opacity ?? 0.4;
  const showVideo = mounted && inView && !reducedMotion;

  const useFeather = feather && mask !== "radial";
  const maskImage = useFeather ? `${MASKS[mask]}, ${SIDE_FEATHER}` : MASKS[mask];
  // Both layers have to clip the same pixels, so composite them as an
  // intersection rather than the default union.
  const maskStyle = {
    maskImage,
    WebkitMaskImage: maskImage,
    ...(useFeather ? { maskComposite: "intersect", WebkitMaskComposite: "source-in" } : {}),
  } as const;

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute z-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {showVideo ? (
        <video
          // Remount on source change so switching themes reloads the clip
          // instead of leaving the previous one painted on the first frame.
          key={source.src}
          src={source.src}
          poster={source.poster}
          autoPlay
          muted
          loop
          playsInline
          preload={priority ? "auto" : "metadata"}
          className="h-full w-full object-cover"
          style={{ opacity, ...maskStyle }}
        />
      ) : (
        <Image
          src={source.poster}
          alt=""
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
          style={{ opacity, ...maskStyle }}
        />
      )}
    </div>
  );
}
