"use client";

import React, { useState } from "react";
import { PixelPreloader } from "@/components/ui/PixelLoader";
import { AnimatePresence } from "motion/react";
import Link from "next/link";

export default function Skiper11PreviewPage() {
  const [activePreset, setActivePreset] = useState<"viperx" | "original">("viperx");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showPreloader, setShowPreloader] = useState(false);

  const presets = {
    viperx: {
      line1: "Real Trades",
      line2: "Verified Performance",
      line3: "Onchain AI Agents",
      strokeColor: "var(--accent, #d0200a)",
    },
    original: {
      line1: "AI that Convert",
      line2: "Linkedin to Professional",
      line3: "Website in minutes",
      strokeColor: "#FFAD42",
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
          <PixelPreloader
            key={`${activePreset}-${theme}`}
            line1={current.line1}
            line2={current.line2}
            line3={current.line3}
            theme={theme}
            strokeColor={current.strokeColor}
          />
        )}
      </AnimatePresence>

      <div className="max-w-xl w-full flex flex-col items-center text-center gap-6 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          Skiper UI / Skiper11
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white font-sans">
          Pixel Preloader
        </h1>
        <p className="text-sm text-foreground-muted max-w-md">
          Retro pixel-style preloader with random granular pixel dissolve and animated hand-drawn highlight stroke.
        </p>

        {/* Controls Card */}
        <div className="w-full bg-[#111318] border border-border/60 rounded-xl p-5 flex flex-col gap-4 text-left">
          {/* Preset Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono uppercase text-foreground-muted">Preset Content</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActivePreset("viperx");
                  setTheme("dark");
                }}
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
                onClick={() => {
                  setActivePreset("original");
                  setTheme("light");
                }}
                className={`px-3 py-2 text-xs font-mono rounded-lg border transition-all ${
                  activePreset === "original"
                    ? "border-[#FFAD42] bg-[#FFAD42]/10 text-[#FFAD42] font-semibold"
                    : "border-border/40 hover:bg-white/5 text-foreground-muted"
                }`}
              >
                Original Skiper11
              </button>
            </div>
          </div>

          {/* Theme Mode Toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono uppercase text-foreground-muted">Theme Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all ${
                  theme === "dark"
                    ? "border-accent bg-accent/10 text-accent font-semibold"
                    : "border-border/40 hover:bg-white/5 text-foreground-muted"
                }`}
              >
                Dark (ViperX Cyber)
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all ${
                  theme === "light"
                    ? "border-white bg-white/10 text-white font-semibold"
                    : "border-border/40 hover:bg-white/5 text-foreground-muted"
                }`}
              >
                Light (Clean Minimal)
              </button>
            </div>
          </div>

          {/* Trigger Button */}
          <button
            type="button"
            onClick={triggerLoader}
            className="mt-2 w-full py-3 px-4 rounded-xl bg-accent text-white font-medium text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-accent/20 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Play Pixel Dissolve Loader</span>
            <span className="text-xs opacity-75">(2.8s)</span>
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-foreground-muted">
          <Link href="/" className="hover:text-white transition-colors underline">
            &larr; ViperX Home
          </Link>
          <span>•</span>
          <Link href="/preview/skiper9" className="hover:text-white transition-colors underline">
            Skiper9 Stairs
          </Link>
          <span>•</span>
          <span>components/ui/skiper-ui/skiper11.tsx</span>
        </div>
      </div>
    </div>
  );
}
