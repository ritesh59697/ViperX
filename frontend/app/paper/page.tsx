"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
    <Section className="pt-20 pb-24 sm:pt-24">
      <div className="mb-10">
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
          <Card variant="default" className="flex flex-col gap-4 text-left">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Configuration
            </p>

            <div>
              <label className="t-label mb-2 block">Strategy</label>
              <div className="flex flex-col gap-1">
                {(["momentum", "mean_reversion", "grid"] as Strategy[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={running}
                    onClick={() => setStrategy(s)}
                    className={`rounded-lg border px-3 py-2 text-left font-mono text-xs transition-all disabled:opacity-50 ${
                      strategy === s
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-foreground-muted hover:border-foreground-muted"
                    }`}
                  >
                    {s === "momentum" && "Momentum Trend"}
                    {s === "mean_reversion" && "RSI Mean Reversion"}
                    {s === "grid" && "Grid Market Maker"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="t-label mb-2 block">Position Size (USD)</label>
              <input
                type="number"
                value={sizeUsd}
                onChange={(e) => setSizeUsd(Number(e.target.value))}
                disabled={running}
                min={10}
                max={5000}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none disabled:opacity-40"
              />
            </div>

            {strategy === "momentum" && (
              <>
                <div>
                  <label className="t-label mb-2 block">Window (ticks): {windowSize}</label>
                  <input type="range" min={5} max={50} value={windowSize} onChange={(e) => setWindowSize(Number(e.target.value))} disabled={running} className="w-full accent-accent" />
                </div>
                <div>
                  <label className="t-label mb-2 block">Threshold: {thresholdBps} bps</label>
                  <input type="range" min={10} max={200} value={thresholdBps} onChange={(e) => setThresholdBps(Number(e.target.value))} disabled={running} className="w-full accent-accent" />
                </div>
              </>
            )}

            {strategy === "mean_reversion" && (
              <>
                <div>
                  <label className="t-label mb-2 block">RSI Oversold: {rsiLower}</label>
                  <input type="range" min={10} max={45} value={rsiLower} onChange={(e) => setRsiLower(Number(e.target.value))} disabled={running} className="w-full accent-accent" />
                </div>
                <div>
                  <label className="t-label mb-2 block">RSI Overbought: {rsiUpper}</label>
                  <input type="range" min={55} max={90} value={rsiUpper} onChange={(e) => setRsiUpper(Number(e.target.value))} disabled={running} className="w-full accent-accent" />
                </div>
              </>
            )}

            {strategy === "grid" && (
              <div>
                <label className="t-label mb-2 block">Grid Spacing: {gridSpacingBps} bps</label>
                <input type="range" min={20} max={300} value={gridSpacingBps} onChange={(e) => setGridSpacingBps(Number(e.target.value))} disabled={running} className="w-full accent-accent" />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant={running ? "secondary" : "primary"}
                onClick={() => setRunning((r) => !r)}
                className="flex-1 justify-center py-2 text-xs"
              >
                {running ? "⏸ Pause" : "▶ Start"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleReset}
                className="py-2 text-xs"
              >
                Reset
              </Button>
            </div>
          </Card>

          {/* Progress toward Devnet ──────────────────────────────────────── */}
          <Card variant="muted" className="text-left">
            <p className="font-mono text-xs font-semibold text-foreground-muted mb-2">
              Journey: Paper → Devnet → Mainnet
            </p>
            <ol className="space-y-2 text-xs text-foreground-muted">
              <li className="flex items-center gap-2">
                <span className="text-amber-400">◉</span>
                <span className="text-foreground">Paper Trading</span>
                <span className="ml-auto text-[10px] text-amber-400 font-mono">← You are here</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-foreground-faint">○</span>
                <span>Deploy on Solana Devnet</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-foreground-faint">○</span>
                <span>Verified Live Performance</span>
              </li>
            </ol>
            {closedTrades.length >= 5 && (
              <div className="mt-4">
                <Button href="/create" variant="primary" className="w-full justify-center text-xs py-2">
                  Deploy on Devnet →
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* ── Center: live chart + stats ─────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Price chart */}
          <Card variant="default" className="text-left">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-mono text-xs font-semibold text-foreground-muted">{market}</p>
                <p className="mt-0.5 font-mono text-2xl font-bold text-foreground">
                  ${currentPrice.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {running && (
                  <span className="flex items-center gap-1 font-mono text-[10px] text-positive">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" />
                    LIVE SIM
                  </span>
                )}
              </div>
            </div>

            <div className="relative h-40 w-full overflow-hidden rounded-lg bg-surface">
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
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Total Equity",
                value: `$${totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                color: totalEquity >= STARTING_BALANCE ? "text-positive" : "text-negative",
              },
              {
                label: "Return",
                value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`,
                color: totalReturn >= 0 ? "text-positive" : "text-negative",
              },
              { label: "Trades", value: closedTrades.length.toString(), color: "text-foreground" },
              {
                label: "Win Rate",
                value: closedTrades.length ? `${winRate.toFixed(1)}%` : "—",
                color: winRate >= 50 ? "text-positive" : closedTrades.length ? "text-negative" : "text-foreground-muted",
              },
            ].map((s) => (
              <Card key={s.label} variant="muted" className="flex flex-col gap-1 text-left">
                <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">{s.label}</p>
                <p className={`font-mono text-lg font-bold ${s.color}`}>{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Open position */}
          {position ? (
            <Card variant="default" className="text-left">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-foreground-muted mb-1">Open Position</p>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${position.side === "long" ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative"}`}>
                      {position.side.toUpperCase()}
                    </span>
                    <span className="font-mono text-sm text-foreground">${position.size} @ ${position.entryPrice.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-foreground-faint">{position.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-foreground-faint">Unrealised P&amp;L</p>
                  <p className={`font-mono text-xl font-bold ${openPnl >= 0 ? "text-positive" : "text-negative"}`}>
                    {openPnl >= 0 ? "+" : ""}${openPnl.toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card variant="muted" className="text-left">
              <p className="font-mono text-xs text-foreground-faint">No open position — strategy is watching the market{running ? "…" : " (paused)"}</p>
            </Card>
          )}

          {/* Trade history */}
          {closedTrades.length > 0 && (
            <Card variant="default" className="text-left">
              <p className="font-mono text-xs font-semibold text-foreground-muted mb-3">Trade History</p>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-foreground-faint">
                      <th className="pb-2 text-left">Side</th>
                      <th className="pb-2 text-right">Entry</th>
                      <th className="pb-2 text-right">Exit</th>
                      <th className="pb-2 text-right">P&L</th>
                      <th className="pb-2 text-left pl-3 hidden sm:table-cell">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {closedTrades.slice(0, 10).map((t) => (
                      <tr key={t.id}>
                        <td className="py-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.side === "long" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"}`}>
                            {t.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 text-right text-foreground">${t.entryPrice.toFixed(2)}</td>
                        <td className="py-2 text-right text-foreground">${t.exitPrice.toFixed(2)}</td>
                        <td className={`py-2 text-right font-semibold ${t.pnl >= 0 ? "text-positive" : "text-negative"}`}>
                          {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                        </td>
                        <td className="py-2 pl-3 text-foreground-faint hidden sm:table-cell max-w-[180px] truncate">{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] text-foreground-faint">
                  Showing {Math.min(10, closedTrades.length)} of {closedTrades.length} trades
                </span>
                <span className={`font-mono text-xs font-semibold ${totalRealizedPnl >= 0 ? "text-positive" : "text-negative"}`}>
                  Realized P&L: {totalRealizedPnl >= 0 ? "+" : ""}${totalRealizedPnl.toFixed(2)}
                </span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Section>
  );
}
