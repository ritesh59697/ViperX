"use client";

import React, { useMemo } from "react";
import { useTradeStore } from "@/lib/trade/tradeStore";
import { formatPrice } from "@/lib/trade/math";
import { RuneIcon, RuneIconName } from "@/components/ui/RuneIcon";
import { cn } from "@/lib/utils";

interface AiCoPilotPanelProps {
  markPrice: number;
}

export const AI_STRATEGIES: Array<{
  id: string;
  name: string;
  tagline: string;
  confidence: number;
  signal: string;
  tpMultiplier: number;
  slMultiplier: number;
  sharpe: string;
  riskLevel: string;
  icon: RuneIconName;
}> = [
  {
    id: "Viper Momentum V2",
    name: "Viper Momentum V2",
    tagline: "Trend expansion & breakout capture",
    confidence: 88,
    signal: "STRONG_BULL",
    tpMultiplier: 1.045, // +4.5%
    slMultiplier: 0.982, // -1.8%
    sharpe: "3.42",
    riskLevel: "Moderate",
    icon: "metrics-trending-up",
  },
  {
    id: "Pyth Arbitrage Alpha",
    name: "Pyth Arbitrage Alpha",
    tagline: "Sub-second cross-venue latency arb",
    confidence: 94,
    signal: "BULLISH",
    tpMultiplier: 1.025, // +2.5%
    slMultiplier: 0.991, // -0.9%
    sharpe: "4.18",
    riskLevel: "Low",
    icon: "metrics-activity",
  },
  {
    id: "Risk-Neutral Grid",
    name: "Risk-Neutral Grid",
    tagline: "Mean reversion around real-time VWAP",
    confidence: 82,
    signal: "NEUTRAL",
    tpMultiplier: 1.03,
    slMultiplier: 0.975,
    sharpe: "2.89",
    riskLevel: "Low",
    icon: "layouts-grid-2x2",
  },
  {
    id: "Delta Hedge Guard",
    name: "Delta Hedge Guard",
    tagline: "Downside delta mitigation & volatility shield",
    confidence: 91,
    signal: "BEARISH",
    tpMultiplier: 0.965,
    slMultiplier: 1.018,
    sharpe: "3.15",
    riskLevel: "High",
    icon: "identity-shield-check",
  },
];

export function AiCoPilotPanel({ markPrice }: AiCoPilotPanelProps) {
  const {
    useAgentDelegation,
    setUseAgentDelegation,
    selectedAgentStrategy,
    setSelectedAgentStrategy,
    side,
    setTakeProfitInput,
    setStopLossInput,
  } = useTradeStore();

  const currentStrategy = useMemo(() => {
    return (
      AI_STRATEGIES.find((s) => s.id === selectedAgentStrategy) ||
      AI_STRATEGIES[0]
    );
  }, [selectedAgentStrategy]);

  // Compute suggested TP and SL anchored to current mark price and side
  const { suggestedTp, suggestedSl } = useMemo(() => {
    if (markPrice <= 0) return { suggestedTp: 0, suggestedSl: 0 };
    if (side === "long") {
      const tp = markPrice * currentStrategy.tpMultiplier;
      const sl = markPrice * currentStrategy.slMultiplier;
      return { suggestedTp: tp, suggestedSl: sl };
    } else {
      // Short inverted
      const tp = markPrice * (2 - currentStrategy.tpMultiplier);
      const sl = markPrice * (2 - currentStrategy.slMultiplier);
      return { suggestedTp: tp, suggestedSl: sl };
    }
  }, [markPrice, side, currentStrategy]);

  const handleApplyAiTpSl = () => {
    if (suggestedTp > 0 && suggestedSl > 0) {
      setTakeProfitInput(suggestedTp.toFixed(2));
      setStopLossInput(suggestedSl.toFixed(2));
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/[0.03] p-2.5 text-xs">
      {/* Header & Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent text-white shadow-xs">
            <RuneIcon name="tools-sparkles" className="h-3 w-3 text-white" />
          </div>
          <div>
            <span className="font-bold text-foreground">Viper Co-Pilot</span>
            <span className="ml-1.5 text-[10px] font-mono text-accent font-semibold">
              Autonomous Layer
            </span>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => setUseAgentDelegation(!useAgentDelegation)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
            useAgentDelegation ? "bg-accent" : "bg-surface"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
              useAgentDelegation ? "translate-x-4" : "translate-x-0"
            )}
          />
        </button>
      </div>

      {useAgentDelegation && (
        <div className="flex flex-col gap-2 pt-0.5 animate-in fade-in-0 duration-200">
          {/* Strategy Selector Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono uppercase text-foreground-muted">
              Execution Strategy
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {AI_STRATEGIES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedAgentStrategy(st.id)}
                  className={cn(
                    "flex flex-col items-start p-1.5 rounded-lg border text-left transition-all cursor-pointer",
                    selectedAgentStrategy === st.id
                      ? "border-accent bg-accent/10 shadow-xs"
                      : "border-border/60 hover:border-border bg-surface/40 text-foreground-muted"
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <RuneIcon
                      name={st.icon}
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        selectedAgentStrategy === st.id ? "text-accent" : "text-foreground-muted"
                      )}
                    />
                    <span className="font-semibold text-[11px] text-foreground truncate">
                      {st.name}
                    </span>
                  </div>
                  <span className="text-[9px] text-foreground-muted truncate w-full pl-5 mt-0.5">
                    Sharpe: {st.sharpe} • {st.riskLevel}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Signal & Real-Time Confidence Gauge */}
          <div className="rounded-lg bg-surface/70 border border-border/60 p-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-foreground-muted">
                Signal Telemetry
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase",
                  currentStrategy.signal.includes("BULL")
                    ? "bg-positive/10 text-positive border border-positive/30"
                    : currentStrategy.signal.includes("BEAR")
                    ? "bg-negative/10 text-negative border border-negative/30"
                    : "bg-surface text-foreground-muted"
                )}
              >
                {currentStrategy.signal.replace("_", " ")}
              </span>
            </div>

            {/* Confidence Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-foreground-muted">Confidence Index</span>
                <span className="font-bold text-accent">{currentStrategy.confidence}% Conviction</span>
              </div>
              <div className="h-1.5 w-full bg-border/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent/70 to-accent rounded-full transition-all duration-500"
                  style={{ width: `${currentStrategy.confidence}%` }}
                />
              </div>
            </div>

            {/* Suggested TP / SL Fast Apply */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] font-mono">
              <div className="flex items-center gap-3">
                <span className="text-positive">TP: {formatPrice(suggestedTp)}</span>
                <span className="text-negative">SL: {formatPrice(suggestedSl)}</span>
              </div>
              <button
                type="button"
                onClick={handleApplyAiTpSl}
                className="px-2 py-0.5 rounded bg-accent/15 hover:bg-accent/25 text-accent font-semibold transition-colors cursor-pointer flex items-center gap-1"
              >
                <RuneIcon name="tools-sparkles" className="h-2.5 w-2.5" />
                <span>Apply Levels</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AiCoPilotPanel;
