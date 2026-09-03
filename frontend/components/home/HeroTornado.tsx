"use client";

import dynamic from "next/dynamic";
import { useTheme } from "@/components/ui/ThemeProvider";

/**
 * The hero's right-hand panel.
 *
 * Loaded client-side only. The engine touches `window`, `document` and
 * `WebGLRenderingContext` at module scope on mount, and `three` is a large
 * dependency the server render has no use for — keeping it out of SSR avoids
 * both the hydration mismatch and the bundle cost on first paint.
 */
const Vortex = dynamic(() => import("@/components/three/Tornado"), {
  ssr: false,
  // Reserve the box so the hero doesn't reflow when the canvas arrives.
  loading: () => <div className="h-full w-full" />,
});

export function HeroTornado() {
  return null; // Hidden for now

  const { theme } = useTheme();
  const isLight = theme === "light";
  const background = "transparent";

  // In light theme, we want dark lines/dots to contrast with the light page background.
  // In dark theme, we want white lines/dots.
  const lineColor = isLight ? "#27272a" : "#ffffff";
  const dotColor = isLight ? "#3f3f46" : "#ffffff";
  const cometColor = "#f0674f"; // Accent color remains the same

  return (
    <Vortex
      background={background}
      isLight={isLight}
      lineOptions={{ color: lineColor }}
      dotOptions={{ color: dotColor }}
      cometOptions={{ color: cometColor }}
      topRadius={380}
      waistRadius={53}
      waistPosition={50}
      bottomRadius={1150}
      twist={3}
      // Left at the preview's value. The crown runs past the top of the panel
      // at this framing, which is the effect reading as a window onto
      // something larger; pulling the camera back to fit the whole form just
      // sinks it behind its own base plate.
      zoom={75}
      speed={10}
      direction="right"
      dots
      comets
    />
  );
}
