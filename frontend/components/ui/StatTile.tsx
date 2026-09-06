"use client";

import React, { useState } from "react";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

interface StatTileProps {
  label: string;
  value: string | number;
  mono?: boolean;
  /** When set, the tile springs the number up from 0 instead of rendering `value` statically. */
  animate?: { value: number; decimals?: number; suffix?: string };
  /** Optional icon override; if omitted, an icon is automatically inferred from the label */
  icon?: React.ReactNode;
  /** Optional full value for copy-to-clipboard on mono addresses */
  fullValue?: string;
  /** Card contour style: "double-outline" (ReactBits compound border) or "single" (clean surface) */
  variant?: "double-outline" | "single";
}

function getDefaultIcon(label: string) {
  const norm = label.toLowerCase();
  if (norm.includes("status")) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    );
  }
  if (norm.includes("trade")) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 3 4 4-4 4" />
        <path d="M20 7H4" />
        <path d="m8 21-4-4 4-4" />
        <path d="M4 17h16" />
      </svg>
    );
  }
  if (norm.includes("leaderboard")) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    );
  }
  if (norm.includes("sharpe")) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    );
  }
  if (norm.includes("roi") || norm.includes("return")) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="5" x2="5" y2="19" />
        <circle cx="6.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </svg>
    );
  }
  if (norm.includes("drawdown")) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  if (norm.includes("owner")) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 1 0-16 0" />
      </svg>
    );
  }
  if (norm.includes("vault")) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  mono,
  animate,
  icon,
  fullValue,
  variant = "double-outline",
}: StatTileProps) {
  const [copied, setCopied] = useState(false);
  const tileIcon = icon || getDefaultIcon(label);
  const normLabel = label.toLowerCase();
  const strVal = String(value);

  const handleCopy = () => {
    if (fullValue || (mono && typeof value === "string")) {
      navigator.clipboard.writeText(fullValue || strVal);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Render value styling based on metric type
  const renderValue = () => {
    if (normLabel.includes("status") && strVal.toLowerCase() === "active") {
      return (
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-positive shrink-0" />
          <span className="font-bold text-positive">{value}</span>
        </div>
      );
    }

    if (normLabel.includes("leaderboard")) {
      const isYes = strVal.toLowerCase() === "yes";
      return (
        <span className={isYes ? "font-bold text-positive" : "font-medium text-foreground-faint"}>
          {value}
        </span>
      );
    }

    if (mono) {
      return (
        <div className="flex items-center justify-between gap-1.5 font-mono text-xs text-accent">
          <span className="truncate">{value}</span>
          <button
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy address"}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-foreground-faint hover:bg-surface hover:text-foreground transition-colors cursor-pointer"
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-positive">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            )}
          </button>
        </div>
      );
    }

    if (animate && Number.isFinite(animate.value)) {
      return (
        <AnimatedNumber
          value={animate.value}
          decimals={animate.decimals ?? 2}
          suffix={animate.suffix ?? ""}
        />
      );
    }

    return value;
  };

  if (variant === "single") {
    return (
      <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-black/10 bg-white p-4.5 shadow-xs transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md dark:border-white/15 dark:bg-[#0e0f13] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:hover:border-white/30 dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.15)]">
        {/* Top row: Label & Micro-Icon Badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground-muted truncate">
            {label}
          </span>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-foreground-faint transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent/5 group-hover:text-accent dark:border-white/10 dark:bg-white/[0.04]">
            {tileIcon}
          </div>
        </div>

        {/* Bottom row: Primary Metric */}
        <div className="mt-2.5 text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-foreground">
          {renderValue()}
        </div>
      </div>
    );
  }

  // Exact ReactBits builder card design:
  // Outer: rounded-xl border p-1 with subtle chassis
  // Inner: h-full rounded-lg bg-background p-4
  // Header: Label on left, icon badge on right
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
      {/* Inner Card Container */}
      <div className="flex h-full flex-col justify-between rounded-lg bg-white p-4 transition-colors dark:bg-[#0a0a0a]">
        {/* Top row: Label & Micro-Icon Badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted truncate">
            {label}
          </span>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-foreground-faint transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent/5 group-hover:text-accent dark:border-white/10 dark:bg-white/[0.04]">
            {tileIcon}
          </div>
        </div>

        {/* Bottom row: Primary Metric Value */}
        <div className="mt-2.5 text-lg font-bold tracking-tight text-foreground transition-colors">
          {renderValue()}
        </div>
      </div>
    </div>
  );
}
