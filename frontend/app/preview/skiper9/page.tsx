"use client";

import React, { useState } from "react";
import { Skiper9, StairsPreloader } from "@/components/ui/StairsLoader";
import { AnimatePresence } from "motion/react";
import Link from "next/link";

export default function Skiper9PreviewPage() {
  const [activePreset, setActivePreset] = useState<"viperx" | "original">("viperx");
  const [columns, setColumns] = useState(5);
  const [showPreloader, setShowPreloader] = useState(false);

  const presets = {
    viperx: {
      text: "Autonomous AI Execution. Period.",
      subtitle: "VIPERX // REAL TRADES. VERIFIED PERFORMANCE.",
    },
    original: {
      text: "The first-ever AGI. Period.",
      subtitle: undefined,
    },
  };

  const current = presets[activePreset];

  const triggerLoader = () => {
    setShowPreloader(true);
    setTimeout(() => {
      setShowPreloader(false);
    }, 2800);
  };

  return (
    <div className="min-h-screen bg-[#07080a] text-white flex flex-col items-center justify-center p-6 relative select-none">
      {/* Interactive Fullscreen Overlay Trigger */}
      <AnimatePresence mode="wait">
        {showPreloader && (
          <StairsPreloader
            key={`${activePreset}-${columns}`}
            text={current.text}
            subtitle={current.subtitle}
            columns={columns}
          />
        )}
      </AnimatePresence>

      <div className="max-w-xl w-full flex flex-col items-center text-center gap-6 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          Skiper UI / Skiper9
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white font-sans">
          Stairs Preloader
        </h1>
        <p className="text-sm text-foreground-muted max-w-md">
          Staircase-style preloader with stepped vertical column animations and staggered word-by-word reveal.
        </p>

        {/* Controls */}
        <div className="w-full bg-[#111318] border border-border/60 rounded-xl p-5 flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono uppercase text-foreground-muted">Preset Text</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActivePreset("viperx")}
                className={`px-3 py-2 text-xs font-mono rounded-lg border transition-all ${
                  activePreset === "viperx"
                    ? "border-accent bg-accent/10 text-accent font-semibold"
                    : "border-border/40 hover:bg-white/5 text-foreground-muted"
                }`}
              >
                ViperX Protocol
              </button>
              <button
                type="button"
                onClick={() => setActivePreset("original")}
                className={`px-3 py-2 text-xs font-mono rounded-lg border transition-all ${
                  activePreset === "original"
                    ? "border-accent bg-accent/10 text-accent font-semibold"
                    : "border-border/40 hover:bg-white/5 text-foreground-muted"
                }`}
              >
                Original Skiper9
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono uppercase text-foreground-muted">
              Stair Columns ({columns})
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 5, 7].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setColumns(count)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all ${
                    columns === count
                      ? "border-accent bg-accent/10 text-accent font-semibold"
                      : "border-border/40 hover:bg-white/5 text-foreground-muted"
                  }`}
                >
                  {count} Columns
                </button>
              ))}
            </div>
          </div>

          {/* Trigger Button */}
          <button
            type="button"
            onClick={triggerLoader}
            className="mt-2 w-full py-3 px-4 rounded-xl bg-accent text-white font-medium text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-accent/20 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Play Skiper9 Loader</span>
            <span className="text-xs opacity-75">(2.8s)</span>
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-foreground-muted">
          <Link href="/" className="hover:text-white transition-colors underline">
            &larr; Back to ViperX Home
          </Link>
          <span>•</span>
          <span>components/ui/skiper-ui/skiper9.tsx</span>
        </div>
      </div>
    </div>
  );
}
