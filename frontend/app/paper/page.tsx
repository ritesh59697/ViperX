"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { ArrowRightGlyph } from "@/components/ui/StatusGlyphs";

// ─── Types ───────────────────────────────────────────────────────────────────

type Strategy = "momentum" | "grid" | "mean_reversion";
type Side = "long" | "short";

interface Position {
  id: string;
  side: Side;
  entryPrice: number;
  size: number; // USD
  openedAt: number; // timestamp
  reason: string;
}

interface ClosedTrade {
  id: string;
  side: Side;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  openedAt: number;
  closedAt: number;
  reason: string;
}

interface Tick {
  price: number;
  ts: number;
}

// ─── Strategy engine (same logic as backtesting simulator, adapted for live) ──

function computeMomentumSignal(
  ticks: Tick[],
  window: number,
  thresholdBps: number,
): "long" | "short" | null {
  if (ticks.length < window + 1) return null;
  const slice = ticks.slice(-window - 1);
  const oldest = slice[0].price;
  const newest = slice[slice.length - 1].price;
  const changeBps = ((newest - oldest) / oldest) * 10_000;
  if (changeBps > thresholdBps) return "long";
  if (changeBps < -thresholdBps) return "short";
  return null;
}

function computeRsi(ticks: Tick[], period: number): number {
  if (ticks.length < period + 1) return 50;
  const changes = ticks.slice(-period - 1).map((t, i, a) => (i === 0 ? 0 : t.price - a[i - 1].price));
  const gains = changes.filter((c) => c > 0).reduce((s, c) => s + c, 0) / period;
  const losses = Math.abs(changes.filter((c) => c < 0).reduce((s, c) => s + c, 0)) / period;
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

// ─── Live price simulator (GBM random walk) ───────────────────────────────────

function nextPrice(prev: number, volatility = 0.0018): number {
  const drift = 0.00005;
  const rand = (Math.random() - 0.5) * 2;
  return prev * (1 + drift + volatility * rand);
}

// ─── Paper Trading Engine ────────────────────────────────────────────────────

const STARTING_BALANCE = 10_000;
const TICK_INTERVAL_MS = 800;
const CHART_POINTS = 60;

export default function PaperTradingPage() {
  const [strategy, setStrategy] = useState<Strategy>("momentum");
  const [market] = useState("SOL-PERP");
  const [running, setRunning] = useState(false);
  const [sizeUsd, setSizeUsd] = useState(200);
  const [thresholdBps, setThresholdBps] = useState(50);
  const [windowSize, setWindowSize] = useState(20);
  const [gridSpacingBps, setGridSpacingBps] = useState(100);
  const [rsiLower, setRsiLower] = useState(35);
  const [rsiUpper, setRsiUpper] = useState(65);

  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [position, setPosition] = useState<Position | null>(null);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [ticks, setTicks] = useState<Tick[]>([{ price: 150, ts: Date.now() }]);
  const [chartPrices, setChartPrices] = useState<number[]>([150]);

  const ticksRef = useRef<Tick[]>([{ price: 150, ts: Date.now() }]);
  const positionRef = useRef<Position | null>(null);
  const balanceRef = useRef(STARTING_BALANCE);
  const closedRef = useRef<ClosedTrade[]>([]);
  const gridBaseRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradeCounterRef = useRef(0);

  positionRef.current = position;
  balanceRef.current = balance;
  closedRef.current = closedTrades;

  const openPosition = useCallback(
    (side: Side, price: number, reason: string) => {
      if (positionRef.current) return;
      const newPos: Position = {
        id: `p-${++tradeCounterRef.current}`,
        side,
        entryPrice: price,
        size: sizeUsd,
        openedAt: Date.now(),
        reason,
      };
      positionRef.current = newPos;
      setPosition(newPos);
    },
    [sizeUsd],
  );

  const closePosition = useCallback((price: number, reason: string) => {
    const pos = positionRef.current;
    if (!pos) return;
    const pnlPct = pos.side === "long"
      ? (price - pos.entryPrice) / pos.entryPrice
      : (pos.entryPrice - price) / pos.entryPrice;
    const pnl = pos.size * pnlPct;
    const trade: ClosedTrade = {
      id: pos.id,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: price,
      size: pos.size,
      pnl,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
      reason,
    };
    positionRef.current = null;
    setPosition(null);
    setBalance((b) => b + pnl);
    setClosedTrades((prev) => [trade, ...prev].slice(0, 50));
  }, []);

  const runStrategyTick = useCallback(
    (localTicks: Tick[]) => {
      const price = localTicks[localTicks.length - 1].price;
      const pos = positionRef.current;

      if (strategy === "momentum") {
        if (!pos) {
          const signal = computeMomentumSignal(localTicks, windowSize, thresholdBps);
          if (signal) openPosition(signal, price, `Momentum breakout ${signal === "long" ? "▲" : "▼"} (${thresholdBps}bps threshold)`);
        } else {
          const signal = computeMomentumSignal(localTicks, windowSize, thresholdBps);
          if (signal && signal !== pos.side) closePosition(price, `Reversal signal detected`);
        }
      } else if (strategy === "mean_reversion") {
        const rsi = computeRsi(localTicks, 14);
        if (!pos) {
          if (rsi <= rsiLower) openPosition("long", price, `RSI oversold: ${rsi.toFixed(1)} ≤ ${rsiLower}`);
          else if (rsi >= rsiUpper) openPosition("short", price, `RSI overbought: ${rsi.toFixed(1)} ≥ ${rsiUpper}`);
        } else {
          const target = (rsiUpper + rsiLower) / 2;
          if ((pos.side === "long" && rsi >= target) || (pos.side === "short" && rsi <= target)) {
            closePosition(price, `RSI mean reversion to ${rsi.toFixed(1)}`);
          }
        }
      } else if (strategy === "grid") {
        if (gridBaseRef.current === null) gridBaseRef.current = price;
        const base = gridBaseRef.current;
        const spacingFrac = gridSpacingBps / 10_000;
        const level = Math.round((price - base) / (base * spacingFrac));
        if (!pos) {
          if (level < 0) openPosition("long", price, `Grid: price below grid level ${level} (buy zone)`);
          else if (level > 0) openPosition("short", price, `Grid: price above grid level ${level} (sell zone)`);
        } else {
          if (pos.side === "long" && level >= 0) closePosition(price, `Grid: price recovered to level ${level}`);
          else if (pos.side === "short" && level <= 0) closePosition(price, `Grid: price dropped to level ${level}`);
        }
      }
    },
    [strategy, thresholdBps, windowSize, gridSpacingBps, rsiLower, rsiUpper, openPosition, closePosition],
  );

  const startEngine = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    gridBaseRef.current = null;
    intervalRef.current = setInterval(() => {
      const prev = ticksRef.current[ticksRef.current.length - 1];
      const newTick: Tick = { price: nextPrice(prev.price), ts: Date.now() };
      ticksRef.current = [...ticksRef.current.slice(-200), newTick];
      setTicks([...ticksRef.current]);
      setChartPrices((p) => [...p.slice(-(CHART_POINTS - 1)), newTick.price]);
      runStrategyTick(ticksRef.current);
    }, TICK_INTERVAL_MS);
  }, [runStrategyTick]);

  const stopEngine = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleReset = useCallback(() => {
    stopEngine();
    setRunning(false);
    setBalance(STARTING_BALANCE);
    setPosition(null);
    setClosedTrades([]);
    ticksRef.current = [{ price: 150, ts: Date.now() }];
    setTicks([{ price: 150, ts: Date.now() }]);
    setChartPrices([150]);
    gridBaseRef.current = null;
    positionRef.current = null;
  }, [stopEngine]);

  useEffect(() => {
    if (running) {
      startEngine();
    } else {
      stopEngine();
    }
    return stopEngine;
  }, [running, startEngine, stopEngine]);

  // Restart engine when strategy params change while running
  useEffect(() => {
    if (running) startEngine();
  }, [strategy, thresholdBps, windowSize, gridSpacingBps, rsiLower, rsiUpper, running, startEngine]);

  // Derived stats
  const currentPrice = ticks[ticks.length - 1]?.price ?? 150;
  const openPnl = position
    ? position.size *
      ((position.side === "long"
        ? (currentPrice - position.entryPrice) / position.entryPrice
        : (position.entryPrice - currentPrice) / position.entryPrice))
    : 0;
  const totalEquity = balance + openPnl;
  const totalReturn = ((totalEquity - STARTING_BALANCE) / STARTING_BALANCE) * 100;
  const winCount = closedTrades.filter((t) => t.pnl > 0).length;
  const winRate = closedTrades.length ? (winCount / closedTrades.length) * 100 : 0;
  const totalRealizedPnl = closedTrades.reduce((s, t) => s + t.pnl, 0);

  // Chart helpers
  const chartMin = chartPrices.length ? Math.min(...chartPrices) * 0.999 : 140;
  const chartMax = chartPrices.length ? Math.max(...chartPrices) * 1.001 : 160;
  const chartRange = chartMax - chartMin || 1;
  const toY = (price: number, h: number) => h - ((price - chartMin) / chartRange) * h;

  const pathD = chartPrices
    .map((p, i) => {
      const x = (i / (CHART_POINTS - 1)) * 100;
      const y = toY(p, 100);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <div className="w-full flex flex-col gap-8 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl">
        <div>
          <div className="flex items-center gap-3">
          <span className="t-label">Paper Trading</span>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            SIMULATED — NOT REAL CAPITAL
          </span>
        </div>
        <h1 className="t-h2 mt-3 text-foreground">Paper Trading Lab</h1>
        <p className="t-body mt-2 max-w-[58ch] text-sm">
          Run your strategy against a live simulated price feed with a virtual{" "}
          <strong className="text-foreground">${STARTING_BALANCE.toLocaleString()}</strong> balance.
          No real capital, no on-chain transactions.{" "}
          <span className="text-foreground-muted">
            Validate your agent before deploying on Devnet →
          </span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left panel: config ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
            <div className="flex flex-col gap-4 rounded-lg bg-white p-5 text-left dark:bg-[#0a0a0a]">
              <div className="flex items-center justify-between border-b border-black/5 pb-2.5 dark:border-white/5">
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                  Configuration
                </p>
                <span className="font-mono text-[10px] text-foreground-faint uppercase tracking-wider">Parameters</span>
              </div>

              <div>
                <label className="t-label mb-2 block">Strategy</label>
                <div className="flex flex-col gap-1.5">
                  {(["momentum", "mean_reversion", "grid"] as Strategy[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={running}
                      onClick={() => setStrategy(s)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left font-mono text-xs transition-all cursor-pointer disabled:opacity-50 ${
                        strategy === s
                          ? "border-accent bg-accent/10 text-accent font-semibold"
                          : "border-black/5 bg-neutral-50 text-foreground-muted hover:border-black/15 hover:text-foreground dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-white/15"
                      }`}
                    >
                      <span>
                        {s === "momentum" && "Momentum Trend"}
                        {s === "mean_reversion" && "RSI Mean Reversion"}
                        {s === "grid" && "Grid Market Maker"}
                      </span>
                      {strategy === s && (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="t-label mb-1.5 block">Position Size (USD)</label>
                <input
                  type="number"
                  value={sizeUsd}
                  onChange={(e) => setSizeUsd(Number(e.target.value))}
                  disabled={running}
                  min={10}
                  max={5000}
                  className="w-full rounded-lg border border-black/10 bg-neutral-50 px-3.5 py-2 font-mono text-xs text-foreground focus:border-accent focus:bg-white focus:outline-none disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:focus:bg-[#000000]"
                />
              </div>

              {strategy === "momentum" && (
                <>
                  <div>
                    <label className="t-label mb-2 block">Window (ticks): {windowSize}</label>
                    <input type="range" min={5} max={50} value={windowSize} onChange={(e) => setWindowSize(Number(e.target.value))} disabled={running} className="w-full accent-accent cursor-pointer" />
                  </div>
                  <div>
                    <label className="t-label mb-2 block">Threshold: {thresholdBps} bps</label>
                    <input type="range" min={10} max={200} value={thresholdBps} onChange={(e) => setThresholdBps(Number(e.target.value))} disabled={running} className="w-full accent-accent cursor-pointer" />
                  </div>
                </>
              )}

              {strategy === "mean_reversion" && (
                <>
                  <div>
                    <label className="t-label mb-2 block">RSI Oversold: {rsiLower}</label>
                    <input type="range" min={10} max={45} value={rsiLower} onChange={(e) => setRsiLower(Number(e.target.value))} disabled={running} className="w-full accent-accent cursor-pointer" />
                  </div>
                  <div>
                    <label className="t-label mb-2 block">RSI Overbought: {rsiUpper}</label>
                    <input type="range" min={55} max={90} value={rsiUpper} onChange={(e) => setRsiUpper(Number(e.target.value))} disabled={running} className="w-full accent-accent cursor-pointer" />
                  </div>
                </>
              )}

              {strategy === "grid" && (
                <div>
                  <label className="t-label mb-2 block">Grid Spacing: {gridSpacingBps} bps</label>
                  <input type="range" min={20} max={300} value={gridSpacingBps} onChange={(e) => setGridSpacingBps(Number(e.target.value))} disabled={running} className="w-full accent-accent cursor-pointer" />
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                <Button
                  type="button"
                  variant={running ? "secondary" : "primary"}
                  onClick={() => setRunning((r) => !r)}
                  className="flex-1 justify-center py-2.5 text-xs font-semibold gap-2 shadow-lg cursor-pointer"
                >
                  {running ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6 4 20 12 6 20 6 4" />
                      </svg>
                      <span>Start</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleReset}
                  className="py-2.5 text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  <span>Reset</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Progress toward Base Sepolia ──────────────────────────────────────── */}
          <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
            <div className="rounded-lg bg-white p-5 text-left dark:bg-[#0a0a0a]">
              <p className="font-mono text-xs font-semibold text-foreground border-b border-black/5 pb-2.5 dark:border-white/5 mb-3">
                Journey: Paper → Testnet → Mainnet
              </p>
              <ol className="space-y-2.5 text-xs text-foreground-muted font-mono">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-foreground font-semibold">Paper Trading</span>
                  <span className="ml-auto text-[10px] text-amber-400">← You are here</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full border border-foreground-faint shrink-0" />
                  <span>Deploy on Base Sepolia</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full border border-foreground-faint shrink-0" />
                  <span>Verified Live Performance</span>
                </li>
              </ol>
              {closedTrades.length >= 5 && (
                <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                  <Button href="/create" variant="primary" className="w-full justify-center text-xs py-2 inline-flex items-center gap-1.5">
                    <span>Deploy on Base Sepolia</span>
                    <ArrowRightGlyph className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Center: live chart + stats ─────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Price chart */}
          <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
            <div className="flex flex-col gap-3 rounded-lg bg-white p-5 text-left dark:bg-[#0a0a0a]">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-foreground-muted">{market}</p>
                  <p className="mt-0.5 font-mono text-2xl font-bold text-foreground">
                    ${currentPrice.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {running && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-positive/20 bg-positive/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-positive">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" />
                      LIVE SIM
                    </span>
                  )}
                </div>
              </div>

              <div className="relative h-44 w-full overflow-hidden rounded-lg border border-black/5 bg-neutral-50 dark:border-white/5 dark:bg-white/[0.02]">
                <svg viewBox={`0 0 100 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  {/* Grid lines */}
                  {[0.25, 0.5, 0.75].map((f) => (
                    <line key={f} x1="0" y1={f * 100} x2="100" y2={f * 100} stroke="currentColor" strokeWidth="0.3" className="text-border" />
                  ))}
                  {/* Price path fill */}
                  {chartPrices.length > 1 && (
                    <path
                      d={`${pathD} L 100 100 L 0 100 Z`}
                      fill="url(#paperGrad)"
                      opacity="0.18"
                    />
                  )}
                  {/* Price line */}
                  {chartPrices.length > 1 && (
                    <path d={pathD} fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  )}
                  {/* Entry price line */}
                  {position && (
                    <line
                      x1="0"
                      y1={toY(position.entryPrice, 100)}
                      x2="100"
                      y2={toY(position.entryPrice, 100)}
                      stroke={openPnl >= 0 ? "#10b981" : "#ef4444"}
                      strokeWidth="0.8"
                      strokeDasharray="2 2"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <defs>
                    <linearGradient id="paperGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C3AED" />
                      <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>

          {/* Stats row — ReactBits Compound Chassis */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Total Equity",
                value: `$${totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                color: totalEquity >= STARTING_BALANCE ? "text-positive" : "text-negative",
                icon: (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" x2="22" y1="10" y2="10" />
                  </svg>
                ),
                iconColor: "text-accent",
              },
              {
                label: "Return",
                value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`,
                color: totalReturn >= 0 ? "text-positive" : "text-negative",
                icon: (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                ),
                iconColor: totalReturn >= 0 ? "text-positive" : "text-negative",
              },
              {
                label: "Trades",
                value: closedTrades.length.toString(),
                color: "text-foreground",
                icon: (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m16 3 4 4-4 4" />
                    <path d="M20 7H4" />
                    <path d="m8 21-4-4 4-4" />
                    <path d="M4 17h16" />
                  </svg>
                ),
                iconColor: "text-foreground-faint",
              },
              {
                label: "Win Rate",
                value: closedTrades.length ? `${winRate.toFixed(1)}%` : "—",
                color: winRate >= 50 ? "text-positive" : closedTrades.length ? "text-negative" : "text-foreground-muted",
                icon: (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6" />
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                  </svg>
                ),
                iconColor: "text-purple-400",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]"
              >
                <div className="flex h-full flex-col justify-between rounded-lg bg-white p-4 transition-colors dark:bg-[#0a0a0a]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted">
                      {s.label}
                    </span>
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] ${s.iconColor} dark:border-white/10 dark:bg-white/[0.04]`}>
                      {s.icon}
                    </div>
                  </div>
                  <span className={`mt-2 block font-mono text-xl font-bold tracking-tight ${s.color}`}>
                    {s.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Open position */}
          {position ? (
            <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
              <div className="flex items-start justify-between rounded-lg bg-white p-4 text-left dark:bg-[#0a0a0a]">
                <div>
                  <p className="font-mono text-xs font-semibold text-foreground-muted mb-1">Open Position</p>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${position.side === "long" ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative"}`}>
                      {position.side.toUpperCase()}
                    </span>
                    <span className="font-mono text-sm text-foreground font-semibold">${position.size} @ ${position.entryPrice.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-foreground-faint">{position.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-foreground-faint uppercase tracking-wider">Unrealised P&amp;L</p>
                  <p className={`font-mono text-xl font-bold ${openPnl >= 0 ? "text-positive" : "text-negative"}`}>
                    {openPnl >= 0 ? "+" : ""}${openPnl.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
              <div className="rounded-lg bg-white p-4 text-left dark:bg-[#0a0a0a]">
                <p className="font-mono text-xs text-foreground-faint">No open position — strategy is watching the market{running ? "…" : " (paused)"}</p>
              </div>
            </div>
          )}

          {/* Trade history */}
          {closedTrades.length > 0 && (
            <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
              <div className="flex flex-col gap-3 rounded-lg bg-white p-5 text-left dark:bg-[#0a0a0a]">
                <div className="flex items-center justify-between border-b border-black/5 pb-2.5 dark:border-white/5">
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted">Trade History</p>
                  <span className="font-mono text-[11px] text-foreground-faint">
                    Showing {Math.min(10, closedTrades.length)} of {closedTrades.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="border-b border-black/5 text-[10px] uppercase tracking-wider text-foreground-faint dark:border-white/5">
                        <th className="pb-2 text-left font-medium">Side</th>
                        <th className="pb-2 text-right font-medium">Entry</th>
                        <th className="pb-2 text-right font-medium">Exit</th>
                        <th className="pb-2 text-right font-medium">P&L</th>
                        <th className="pb-2 text-left pl-3 hidden sm:table-cell font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {closedTrades.slice(0, 10).map((t) => (
                        <tr key={t.id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.side === "long" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"}`}>
                              {t.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-foreground">${t.entryPrice.toFixed(2)}</td>
                          <td className="py-2.5 text-right text-foreground">${t.exitPrice.toFixed(2)}</td>
                          <td className={`py-2.5 text-right font-semibold ${t.pnl >= 0 ? "text-positive" : "text-negative"}`}>
                            {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                          </td>
                          <td className="py-2.5 pl-3 text-foreground-faint hidden sm:table-cell max-w-[180px] truncate">{t.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-3 dark:border-white/5">
                  <span className="text-[11px] text-foreground-faint">
                    Realized P&L
                  </span>
                  <span className={`font-mono text-xs font-semibold ${totalRealizedPnl >= 0 ? "text-positive" : "text-negative"}`}>
                    {totalRealizedPnl >= 0 ? "+" : ""}${totalRealizedPnl.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </Section>
  );
}
