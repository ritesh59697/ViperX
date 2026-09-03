"use client";

import dynamic from "next/dynamic";
import { useTheme } from "@/components/ui/ThemeProvider";

/**
 * The hero's right-hand panel: a themed black-hole accretion disk.
 *
 * Loaded client-side only — the engine touches `window`, `ResizeObserver` and a
 * `<canvas>` 2D context on mount, none of which the server render can use, and
 * keeping it out of SSR avoids the hydration mismatch. The box is reserved by
 * the parent so the hero doesn't reflow when the canvas arrives.
 *
 * The stage is transparent so the disk sits directly on the page rather than in
 * a black box. The event-horizon sphere is filled with the page background so it
 * still occludes particles passing behind it while reading as a true hole in
 * both themes, and the palette flips to stay legible on light vs. dark.
 */
const BlackHole = dynamic(() => import("./BlackHole"), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

export function HeroBlackHole() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  // The central event-horizon sphere is the brand red, so the core reads as a
  // glowing orb rather than a hole. Uses the theme accent (matching
  // app/globals.css --accent) so it tracks the rest of the UI.
  const voidColor = isLight ? "#d0200a" : "#f42601";

  // Monochrome disk: black particles on the light page, white on the dark page,
  // each with a couple of shades of depth so the accretion disk still reads as
  // 3D rather than a flat ring.
  const colors = isLight
    ? ["#3f3f46", "#3f3f46", "#52525b", "#6b6b72"]
    : ["#d4d4d8", "#c9c9ce", "#a1a1aa", "#71717a"];

  return (
    <BlackHole
      background="transparent"
      voidColor={voidColor}
      particleCount={1100}
      particleSize={3.4}
      colors={colors}
      centre={{ voidRadius: 60, voidX: 50, voidY: 50 }}
      outerRadius={94}
      tilt={18}
      tiltSideway={162}
      trail={50}
      orbitSpeed={4}
      pullSpeed={0}
    />
  );
}
