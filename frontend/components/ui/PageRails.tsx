"use client";

import React from "react";

/**
 * Continuous Blueprint Rails running down the page gutters.
 * Seamless, unbroken by section boundaries, and symmetrically mirrored:
 * - Left rail: 1px hairline on left, 9px horizontal ticks pointing inward (right).
 * - Right rail: 1px hairline on right, 9px horizontal ticks pointing inward (left).
 * - Symmetrically equalized and positioned near the outer edges of the viewport.
 */
export function PageRails() {
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
