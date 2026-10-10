"use client";

import React from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/skiper-ui/skiper101";

export function InfoTooltip({
  content,
  position = "top",
  align = "center",
  children,
}: {
  content: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end" | "left" | "right";
  children?: React.ReactNode;
}) {
  const alignProp = align === "left" ? "start" : align === "right" ? "end" : align;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        {children ? (
          children
        ) : (
          <button
            type="button"
            className="inline-flex items-center justify-center text-foreground-faint transition-colors hover:text-foreground-muted focus-visible:outline-none cursor-help"
            aria-label="More information"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-70 transition-opacity hover:opacity-100"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side={position} align={alignProp}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
