"use client";

import React from "react";
import { usePathname } from "next/navigation";

/**
 * Continuous Blueprint Rails running down the page gutters.
 * Disabled on /trade terminal to avoid unwanted vertical lines in the trading UI.
 */
export function PageRails() {
  const pathname = usePathname();

  if (pathname === "/trade" || pathname?.startsWith("/trade")) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 hidden w-full select-none lg:block overflow-hidden"
    >
      <div className="relative h-full w-full">
        {/* Left Gutter: Blueprint Rail */}
        <div className="bp-rail-left" />

        {/* Right Gutter: Blueprint Rail */}
        <div className="bp-rail-right" />
      </div>
    </div>
  );
}
