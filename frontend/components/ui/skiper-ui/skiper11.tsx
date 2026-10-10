"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export interface StrokeProps extends React.ComponentProps<"svg"> {
  strokeColor?: string;
}

export const Stroke = ({ className, strokeColor = "var(--accent, #d0200a)", ...props }: StrokeProps) => (
  <svg
    width="128"
    height="21"
    viewBox="0 0 128 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("overflow-visible", className)}
    {...props}
  >
    <g clipPath="url(#clip0_3_592)">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
        d="M2.12988 2.1001L58.1362 2.1001L127.805 8.4001L31.6326 10.5001L90.1184 18.9001L65.0899 18.9001"
        stroke={strokeColor}
        strokeWidth="6"
        strokeLinecap="round"
      />
    </g>
    <defs>
      <clipPath id="clip0_3_592">
        <rect width="128" height="21" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export interface PixelPreloaderProps {
  /** First headline line. Defaults to "Autonomous AI Execution." */
  line1?: string;
  /** Second headline line. Highlighted with stroke. */
  line2?: string;
  /** Third headline line */
  line3?: string;
  /** Background theme: 'dark' (ViperX dark style) or 'light' (original skiper11) */
  theme?: "dark" | "light";
  /** Stroke color for the highlight underline */
  strokeColor?: string;
  /** ClassName for the overlay container */
  className?: string;
}

export function PixelPreloader({
  line1 = "Real Trades",
  line2 = "Verified Performance",
  line3 = "Onchain AI Agents",
  theme,
  strokeColor = "var(--accent, #d0200a)",
  className,
}: PixelPreloaderProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">(() => {
    if (theme) return theme;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("viperx-theme");
      if (stored === "dark" || stored === "light") return stored;
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "dark";
  });

  useEffect(() => {
    if (theme) {
      setCurrentTheme(theme);
    } else {
      const stored = localStorage.getItem("viperx-theme");
      if (stored === "dark" || stored === "light") {
        setCurrentTheme(stored);
      } else {
        setCurrentTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
      }
    }
  }, [theme]);

  useEffect(() => {
    setMounted(true);
    setDimensions({ width: window.innerWidth, height: window.innerHeight });

    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Compute number of rows per 5vw column
  const totalRows = useMemo(() => {
    if (!dimensions.width || !dimensions.height) return 20;
    const colWidth = 0.05 * dimensions.width;
    return Math.ceil(dimensions.height / colWidth);
  }, [dimensions.width, dimensions.height]);

  // Fisher-Yates shuffle generator for random dissolve
  const shuffledIndicesPerColumn = useMemo(() => {
    if (!mounted || totalRows <= 0) return [];
    return Array.from({ length: 20 }, () => {
      const arr = Array.from({ length: totalRows }, (_, i) => i);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  }, [mounted, totalRows]);

  const isDark = currentTheme === "dark";

  return (
    <motion.div
      className={cn(
        "fixed inset-0 z-[100] select-none",
        theme === "dark"
          ? "bg-[#07080a]"
          : theme === "light"
          ? "bg-white"
          : "bg-white dark:bg-[#07080a]",
        className
      )}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6, delay: 0.2 } }}
    >
      {/* Centered Typography & Content */}
      <motion.div
        className="fixed left-1/2 z-40 flex min-h-screen w-screen -translate-x-1/2 flex-col items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.5 } }}
        exit={{ opacity: 0, transition: { duration: 0.3 } }}
      >
        <div
          className={cn(
            "fixed z-0 size-[420px] blur-3xl pointer-events-none rounded-full",
            theme === "dark"
              ? "bg-accent/15"
              : theme === "light"
              ? "bg-accent/5"
              : "bg-accent/5 dark:bg-accent/15"
          )}
        />

        <div
          className={cn(
            "relative z-10 font-sans text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center flex flex-col items-center gap-1.5",
            theme === "dark"
              ? "text-white"
              : theme === "light"
              ? "text-[#111318]"
              : "text-[#111318] dark:text-white"
          )}
        >
          {line1 && <h1 className="text-center">{line1}</h1>}

          {line2 && (
            <div className="relative inline-block">
              <h1 className="relative z-10">{line2}</h1>
              <Stroke
                className="absolute right-0 -bottom-3 sm:-bottom-4 w-28 sm:w-36"
                strokeColor={strokeColor}
              />
            </div>
          )}

          {line3 && <h1 className="relative z-10 mt-2 sm:mt-3">{line3}</h1>}
        </div>
      </motion.div>

      {/* Granular Pixel Dissolve Grid (20 vertical columns of 5vw pixels) */}
      <div className="pointer-events-none fixed inset-0 z-[2] flex">
        {mounted &&
          shuffledIndicesPerColumn.map((shuffled, colIdx) => (
            <div key={colIdx} className="flex w-[5vw] flex-col">
              {shuffled.map((shuffledIdx, rowIdx) => (
                <motion.div
                  key={rowIdx}
                  className={cn(
                    "h-[5vw] w-full border-[0.2px]",
                    theme === "dark"
                      ? "border-black/50 bg-[#0c0d12]"
                      : theme === "light"
                      ? "border-[#e5e7eb] bg-[#f0f1f4]"
                      : "border-[#e5e7eb] bg-[#f0f1f4] dark:border-black/50 dark:bg-[#0c0d12]"
                  )}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0, delay: 0.022 * shuffledIdx }}
                />
              ))}
            </div>
          ))}
      </div>
    </motion.div>
  );
}

export interface Skiper11Props {
  /** First headline line */
  line1?: string;
  /** Second headline line with animated underline */
  line2?: string;
  /** Third headline line */
  line3?: string;
  /** Background theme: 'dark' (default for ViperX) or 'light' (original Skiper UI) */
  theme?: "dark" | "light";
  /** Stroke color for the highlight underline */
  strokeColor?: string;
  /** Duration in ms before auto-dismiss (default: 2500) */
  duration?: number;
  /** Controlled visibility state */
  show?: boolean;
  /** Callback when preloader finishes */
  onComplete?: () => void;
  /** Optional children to render inside */
  children?: React.ReactNode;
}

/**
 * Skiper11 - Pixel Preloader Component from Skiper UI
 * Retro pixel-style preloader with granular random pixel dissolve effects.
 */
export function Skiper11({
  line1 = "Real Trades",
  line2 = "Verified Performance",
  line3 = "Onchain AI Agents",
  theme,
  strokeColor = "var(--accent, #d0200a)",
  duration = 2500,
  show: controlledShow,
  onComplete,
  children,
}: Skiper11Props) {
  const [internalLoading, setInternalLoading] = useState(true);

  const isVisible = controlledShow !== undefined ? controlledShow : internalLoading;

  useEffect(() => {
    if (controlledShow !== undefined) return;

    const timer = setTimeout(() => {
      setInternalLoading(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [controlledShow, duration, onComplete]);

  return (
    <main className="relative h-full w-full">
      <AnimatePresence mode="wait">
        {isVisible && (
          <PixelPreloader
            line1={line1}
            line2={line2}
            line3={line3}
            theme={theme}
            strokeColor={strokeColor}
          />
        )}
      </AnimatePresence>
      {children}
    </main>
  );
}

export default Skiper11;
