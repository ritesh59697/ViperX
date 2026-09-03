"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CheckGlyph } from "@/components/ui/StatusGlyphs";

export interface StrategyTemplate {
  id: string;
  name: string;
  badge: string;
  description: string;
  strategyUri: string;
  parameters: { label: string; value: string }[];
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "momentum",
    name: "Momentum Trend Follower",
    badge: "Trend Following",
    description:
      "Detects directional price momentum over a rolling window (20 ticks) and opens long/short positions on threshold breakouts.",
    strategyUri: "https://viperx.hub/strategies/momentum-v1.json",
    parameters: [
      { label: "Window", value: "20 ticks" },
      { label: "Threshold", value: "0.50% (50 bps)" },
      { label: "Trade Size", value: "$20 USD" },
    ],
  },
  {
    id: "mean-reversion",
    name: "RSI Mean Reversion",
    badge: "Range Trading",
    description:
      "Calculates Relative Strength Index (RSI). Buys oversold dips (RSI <= 35) and shorts overbought spikes (RSI >= 65), exiting at the mean.",
    strategyUri: "https://viperx.hub/strategies/mean-reversion-v1.json",
    parameters: [
      { label: "RSI Window", value: "14 ticks" },
      { label: "Bounds", value: "RSI 35 / 65" },
      { label: "Trade Size", value: "$25 USD" },
    ],
  },
  {
    id: "grid",
    name: "Automated Grid Trading",
    badge: "Grid Market Maker",
    description:
      "Establishes a dynamic grid around baseline market prices, placing automated buy-low and sell-high orders on grid spacing boundaries.",
    strategyUri: "https://viperx.hub/strategies/grid-v1.json",
    parameters: [
      { label: "Grid Spacing", value: "0.30% (30 bps)" },
      { label: "Grid Mode", value: "Symmetric" },
      { label: "Trade Size", value: "$30 USD" },
    ],
  },
];

interface StrategySelectorProps {
  selectedId?: string;
  onSelect?: (template: StrategyTemplate) => void;
}

export function StrategySelector({ selectedId = "momentum", onSelect }: StrategySelectorProps) {
  // The create flow owns selection in its own form state and passes `onSelect`
  // (controlled). The landing page renders this as a standalone preset browser
  // with nothing above it holding that state, so fall back to local state —
  // without this, every card but the default one is inert: the click handler
  // fires into an undefined callback and `selectedId` never moves.
  const [internalId, setInternalId] = useState(selectedId);
  const isControlled = onSelect !== undefined;
  const activeId = isControlled ? selectedId : internalId;

  const handleSelect = (tmpl: StrategyTemplate) => {
    if (isControlled) onSelect(tmpl);
    else setInternalId(tmpl.id);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {STRATEGY_TEMPLATES.map((tmpl) => {
        const isSelected = tmpl.id === activeId;
        return (
          <motion.div
            key={tmpl.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => handleSelect(tmpl)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelect(tmpl);
              }
            }}
            // `surface`/`surface-hover` rather than a bare hover:bg tint: a
            // translucent hover background would replace the card's own solid
            // one and let the dither field show through the copy.
            className={`surface surface-hover cursor-pointer p-6 ${
              isSelected ? "!border-accent" : ""
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="border border-accent/30 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-accent">
                {tmpl.badge}
              </span>
              {isSelected && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-accent">
                  <CheckGlyph className="h-3 w-3" />
                  Selected
                </span>
              )}
            </div>

            <h3 className="font-mono text-sm font-bold uppercase tracking-[0.02em] text-foreground">
              {tmpl.name}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground-muted">{tmpl.description}</p>

            <div className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-foreground-faint space-y-1.5">
              {tmpl.parameters.map((p) => (
                <div key={p.label} className="flex justify-between">
                  <span>{p.label}:</span>
                  <span className="text-foreground-muted font-medium">{p.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
