"use client";

import dynamic from "next/dynamic";

const ViperCanvasRoot = dynamic(
  () => import("./ViperScene").then((mod) => mod.ViperCanvasRoot),
  { ssr: false, loading: () => null },
);

/** Mounted exactly once, in app/layout.tsx, so every route shares one WebGL context. */
export function ViperCanvasIsland() {
  return <ViperCanvasRoot />;
}
