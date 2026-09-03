"use client";

import dynamic from "next/dynamic";

const SIZE_CLASSES = {
  lg: "h-72 w-72 md:h-[26rem] md:w-[26rem]",
  sm: "h-16 w-16",
} as const;

function PlaceholderSquiggle() {
  return (
    <svg viewBox="0 0 100 40" className="h-full w-full opacity-30" aria-hidden>
      <path
        d="M5 20 Q 20 5, 35 20 T 65 20 T 95 20"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ViperView = dynamic(() => import("./ViperScene").then((mod) => mod.ViperView), {
  ssr: false,
  loading: () => <PlaceholderSquiggle />,
});

/**
 * A cheap, normal-flow tracked <div> that tells the single shared viper
 * canvas (mounted once via ViperCanvasIsland in layout.tsx) where on screen
 * to render — navigating between routes swaps this div, never the canvas.
 */
export function ViewportTracker({
  size = "sm",
  scrollLinked = false,
  className = "",
}: {
  size?: keyof typeof SIZE_CLASSES;
  scrollLinked?: boolean;
  className?: string;
}) {
  return (
    <div className={`${SIZE_CLASSES[size]} ${className}`.trim()}>
      <ViperView scale={size === "lg" ? 1 : 0.4} scrollLinked={scrollLinked} />
    </div>
  );
}
