"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export interface Skiper9Props {
  /** Text to reveal in the loader. Defaults to "The first-ever AGI. Period." */
  text?: string;
  /** Subtitle or kicker text displayed above or below the main title */
  subtitle?: string;
  /** Number of vertical staircase columns. Default is 5. */
  columns?: number;
  /** Time in milliseconds before preloader automatically dismisses. Default is 2500. */
  duration?: number;
  /** Controlled visibility flag. If provided, overrides internal timer. */
  show?: boolean;
  /** Callback triggered when the preloader exits */
  onComplete?: () => void;
  /** Additional CSS class for the background columns. Defaults to 'bg-black dark:bg-[#07080a]' */
  columnClassName?: string;
  /** Additional CSS class for the main text container */
  textClassName?: string;
  /** Optional children to render beneath or after the preloader dismisses */
  children?: React.ReactNode;
}

export interface StairsPreloaderProps {
  /** Text to reveal in the loader. Defaults to "The first-ever AGI. Period." */
  text?: string;
  /** Subtitle or kicker text */
  subtitle?: string;
  /** Number of vertical columns. Default is 5. */
  columns?: number;
  /** Additional CSS class for the background columns */
  columnClassName?: string;
  /** Additional CSS class for text */
  textClassName?: string;
}

/**
 * Preloader overlay with stepped vertical column transitions and word-by-word title reveal
 */
export function StairsPreloader({
  text = "The first-ever AGI. Period.",
  subtitle,
  columns = 5,
  columnClassName,
  textClassName,
}: StairsPreloaderProps) {
  const words = text.split(" ");
  const cols = Array.from({ length: columns });

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto select-none"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8, delay: 0.2 } }}
    >
      {/* Centered text reveal layer */}
      <div className="absolute z-20 flex flex-col items-center justify-center text-center px-6">
        {subtitle && (
          <motion.span
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-mono text-xs uppercase tracking-widest text-accent mb-3 block"
          >
            {subtitle}
          </motion.span>
        )}

        <motion.h1
          className={cn(
            "text-2xl sm:text-4xl md:text-5xl font-semibold tracking-tighter text-white font-sans",
            textClassName
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 4 } }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
        >
          {words.map((word, idx) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.8, delay: 0.15 * idx }}
              className="mr-2 inline-block"
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>
      </div>

      {/* Stepped vertical staircase columns */}
      <div className="pointer-events-none fixed inset-0 z-10 flex h-screen w-full">
        {cols.map((_, idx) => (
          <motion.div
            key={idx}
            initial={{ height: "100%" }}
            animate={{ height: "100%" }}
            exit={{ height: 0 }}
            transition={{
              duration: 0.55,
              delay: 0.35 + 0.05 * (columns - 1 - idx),
              ease: [0.33, 1, 0.68, 1],
            }}
            style={{ width: `${100 / columns}vw` }}
            className={cn("h-full bg-black", columnClassName)}
          />
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Skiper9 - Stairs Preloader Component from Skiper UI
 * Staircase-style preloader with stepped animations and geometric patterns.
 */
export function Skiper9({
  text = "The first-ever AGI. Period.",
  subtitle,
  columns = 5,
  duration = 2500,
  show: controlledShow,
  onComplete,
  columnClassName,
  textClassName,
  children,
}: Skiper9Props) {
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
          <StairsPreloader
            text={text}
            subtitle={subtitle}
            columns={columns}
            columnClassName={columnClassName}
            textClassName={textClassName}
          />
        )}
      </AnimatePresence>
      {children}
    </main>
  );
}

export default Skiper9;
