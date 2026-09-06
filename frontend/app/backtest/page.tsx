"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui/Section";
import { runBacktest, generateRegimeData, BacktestParams, BacktestTrade, PriceTick } from "@/lib/backtest/simulator";

const MARKETS = [
  { value: "SOL-PERP", label: "SOL-PERP" },
  { value: "BTC-PERP", label: "BTC-PERP" },
  { value: "ETH-PERP", label: "ETH-PERP" },
];

const BullIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const BearIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
  </svg>
);

const RangeIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m-4 5H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const CrashIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const WarningIcon = ({ className = "h-4 w-4 text-warning" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const RocketIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4.5 16.5c-1.5 1.26-2 3.5-2 3.5s2.24-.5 3.5-2" />
    <path d="M22 2c-1.25.75-5.5 3.25-8.5 7.5-3 4.25-3 9.25-3 9.25s5 0 9.25-3c4.25-3 6.75-7.25 7.5-8.5" />
    <path d="M10 14l-4 4-1-2.5L2.5 14l4-4 4 4z" />
    <path d="M16 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
  </svg>
);

const REGIME_ICONS = {
  bull: <BullIcon className="h-4 w-4 text-positive" />,
  bear: <BearIcon className="h-4 w-4 text-negative" />,
  range: <RangeIcon className="h-4 w-4 text-accent" />,
  crash: <CrashIcon className="h-4 w-4 text-warning" />,
};

const REGIMES = [
  { value: "bull", label: "Bull Trend (Upward Drift)", desc: "Simulates an upward trending market with standard crypto volatility." },
  { value: "bear", label: "Bear Market (Downward Panic)", desc: "Simulates a declining market with higher volatility and sharp panics." },
  { value: "range", label: "Rangebound (Choppy Consolidation)", desc: "Simulates oscillating support/resistance boundaries." },
  { value: "crash", label: "Flash Crash & Recovery", desc: "Simulates a stable period, a sudden sharp 30% dump, and a V-shaped recovery." },
] as const;

export default function BacktestLab() {
  const router = useRouter();
  const [strategy, setStrategy] = useState<"momentum" | "grid" | "mean_reversion">("momentum");
  const [market, setMarket] = useState("SOL-PERP");
  const [regime, setRegime] = useState<"bull" | "bear" | "range" | "crash">("range");
  const [startingCapital, setStartingCapital] = useState(1000);
  const [sizeUsd, setSizeUsd] = useState(100);

  // Strategy custom knobs
  const [thresholdBps, setThresholdBps] = useState(50);
  const [windowSize, setWindowSize] = useState(20);
  const [gridSpacingBps, setGridSpacingBps] = useState(100);
  const [rsiLowerThreshold, setRsiLowerThreshold] = useState(30);
  const [rsiUpperThreshold, setRsiUpperThreshold] = useState(70);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof runBacktest> | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tradesPage, setTradesPage] = useState(1);
  const tradesPerPage = 6;

  const handleRunBacktest = () => {
    setLoading(true);
    // Tiny artificial delay to feel premium
    setTimeout(() => {
      const ticks = generateRegimeData(regime, 150, 400);
      const params: BacktestParams = {
        strategyType: strategy,
        startingCapital,
        marketSymbol: market,
        regime,
        sizeUsd,
        thresholdBps,
        windowSize,
        gridSpacingBps,
        rsiLowerThreshold,
        rsiUpperThreshold,
      };
      const res = runBacktest(params, ticks);
      setResult(res);
      setTradesPage(1);
      setHoverIndex(null);
      setLoading(false);
    }, 450);
  };

  const handleDeployRedirect = () => {
    if (!result) return;
    // Route to agent deployment with prepopulated query params
    const query = new URLSearchParams({
      strategy,
      sizeUsd: sizeUsd.toString(),
      thresholdBps: thresholdBps.toString(),
      windowSize: windowSize.toString(),
      gridSpacingBps: gridSpacingBps.toString(),
      rsiLower: rsiLowerThreshold.toString(),
      rsiUpper: rsiUpperThreshold.toString(),
    }).toString();
    router.push(`/create?${query}`);
  };

  // SVG dimensions for custom chart
  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 30, left: 60 };

  const chartData = useMemo(() => {
    if (!result) return null;
    const curve = result.equityCurve;
    const minTime = curve[0].timestamp;
    const maxTime = curve[curve.length - 1].timestamp;
    const equities = curve.map((c) => c.equity);
    const prices = curve.map((c) => c.price);
    const minEq = Math.min(...equities) * 0.98;
    const maxEq = Math.max(...equities) * 1.02;

    const points = curve.map((c, i) => {
      const x = padding.left + ((c.timestamp - minTime) / (maxTime - minTime)) * (width - padding.left - padding.right);
      const y = padding.top + (1 - (c.equity - minEq) / (maxEq - minEq)) * (height - padding.top - padding.bottom);
      return { x, y, timestamp: c.timestamp, equity: c.equity, price: c.price };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const fillPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

    return { points, linePath, fillPath, minEq, maxEq, minTime, maxTime };
  }, [result]);

  const svgRef = useRef<SVGSVGElement>(null);
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!chartData || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    
    // Find closest point by x coordinate
    let closestIdx = 0;
    let minDiff = Infinity;
    chartData.points.forEach((p, idx) => {
      const diff = Math.abs(p.x - x);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setHoverIndex(closestIdx);
  };

  const currentHoverPoint = useMemo(() => {
    if (!chartData || hoverIndex === null) return null;
    return chartData.points[hoverIndex];
  }, [chartData, hoverIndex]);

  const paginatedTrades = useMemo(() => {
    if (!result) return [];
    const start = (tradesPage - 1) * tradesPerPage;
    return result.trades.slice(start, start + tradesPerPage);
  }, [result, tradesPage]);

  const totalTradesPages = result ? Math.ceil(result.trades.length / tradesPerPage) : 0;

  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <div className="w-full flex flex-col gap-8 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl">
        <div>
          <h1 className="t-h1 text-foreground">Backtesting Lab</h1>
          <p className="t-body mt-2 text-foreground-muted max-w-2xl">
            Validate and stress-test your trading bot configurations under custom market conditions
            before allocating live test funds.
          </p>
        </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Input configurations */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
            <div className="flex flex-col gap-5 rounded-lg bg-white p-5 dark:bg-[#0a0a0a]">
              <h2 className="text-base font-semibold text-foreground border-b border-black/5 dark:border-white/5 pb-2">1. Strategy Settings</h2>

            {/* Strategy Select */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground-muted">Strategy</label>
              <div className="grid grid-cols-3 gap-2">
                {(["momentum", "grid", "mean_reversion"] as const).map((strat) => (
                  <button
                    key={strat}
                    onClick={() => setStrategy(strat)}
                    className={`rounded-lg py-2 text-xs font-semibold border transition-all cursor-pointer ${
                      strategy === strat
                        ? "bg-accent/10 border-accent text-accent"
                        : "bg-surface border-border text-foreground-muted hover:border-foreground-faint hover:text-foreground"
                    }`}
                  >
                    {strat === "mean_reversion" ? "RSI Reversion" : strat.charAt(0).toUpperCase() + strat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Market Select */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground-muted">Target Market</label>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none cursor-pointer"
              >
                {MARKETS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Capital Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground-muted">Starting Cash</label>
                <input
                  type="number"
                  value={startingCapital}
                  onChange={(e) => setStartingCapital(Math.max(10, Number(e.target.value)))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground-muted">Trade Size (USD)</label>
                <input
                  type="number"
                  value={sizeUsd}
                  onChange={(e) => setSizeUsd(Math.min(startingCapital, Math.max(1, Number(e.target.value))))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Strategy Parameters Customization */}
            <div className="border-t border-border pt-4 mt-2">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Strategy Parameters</h3>
              
              {strategy === "momentum" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground-muted">Trend Threshold</span>
                      <span className="font-mono text-accent">{thresholdBps} bps</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="300"
                      value={thresholdBps}
                      onChange={(e) => setThresholdBps(Number(e.target.value))}
                      className="w-full accent-accent bg-border h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground-muted">Lookback Window</span>
                      <span className="font-mono text-accent">{windowSize} ticks</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={windowSize}
                      onChange={(e) => setWindowSize(Number(e.target.value))}
                      className="w-full accent-accent bg-border h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {strategy === "grid" && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground-muted">Grid Interval / Spacing</span>
                    <span className="font-mono text-accent">{gridSpacingBps} bps</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="500"
                    value={gridSpacingBps}
                    onChange={(e) => setGridSpacingBps(Number(e.target.value))}
                    className="w-full accent-accent bg-border h-1 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              {strategy === "mean_reversion" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground-muted">Oversold Threshold (RSI)</span>
                      <span className="font-mono text-accent">{rsiLowerThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="45"
                      value={rsiLowerThreshold}
                      onChange={(e) => setRsiLowerThreshold(Number(e.target.value))}
                      className="w-full accent-accent bg-border h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground-muted">Overbought Threshold (RSI)</span>
                      <span className="font-mono text-accent">{rsiUpperThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min="55"
                      max="85"
                      value={rsiUpperThreshold}
                      onChange={(e) => setRsiUpperThreshold(Number(e.target.value))}
                      className="w-full accent-accent bg-border h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground-muted">Lookback Window</span>
                      <span className="font-mono text-accent">{windowSize} periods</span>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="40"
                      value={windowSize}
                      onChange={(e) => setWindowSize(Number(e.target.value))}
                      className="w-full accent-accent bg-border h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

          <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
            <div className="flex flex-col gap-4 rounded-lg bg-white p-5 dark:bg-[#0a0a0a]">
              <h2 className="text-base font-semibold text-foreground border-b border-black/5 dark:border-white/5 pb-2">2. Market Regime</h2>
            <div className="flex flex-col gap-3">
              {REGIMES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRegime(r.value)}
                  className={`flex flex-col gap-1 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    regime === r.value
                      ? "bg-accent/5 border-accent/60"
                      : "bg-surface border-border hover:border-foreground-muted"
                  }`}
                >
                  <span className={`text-sm font-semibold flex items-center gap-2 ${regime === r.value ? "text-accent" : "text-foreground"}`}>
                    {REGIME_ICONS[r.value]}
                    {r.label}
                  </span>
                  <span className="text-xs text-foreground-muted leading-relaxed pl-6">
                    {r.desc}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleRunBacktest}
              disabled={loading}
              className="mt-2 w-full h-11 inline-flex items-center justify-center rounded-lg bg-accent text-accent-foreground font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-accent/20"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground border-t-transparent" />
                  Running simulation...
                </div>
              ) : (
                "Run Backtest"
              )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Performance Results */}
        <div className="lg:col-span-8">
          {!result ? (
            <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414] h-full">
              <div className="flex flex-col items-center justify-center rounded-lg bg-white p-12 h-full min-h-[440px] text-center dark:bg-[#0a0a0a]">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-black/8 bg-black/[0.03] text-foreground-muted mb-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <svg className="h-7 w-7 text-foreground-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-foreground">Awaiting Simulation Configuration</h3>
                <p className="text-xs text-foreground-muted mt-2 max-w-sm leading-relaxed">
                  Choose a trading strategy, adjust parameters, select a market regime and click <span className="font-semibold text-accent">Run Backtest</span> to analyze performance.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Backtest Label Notice Banner */}
              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 flex gap-3 text-warning items-start">
                <WarningIcon className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold">Historical Backtest Mode:</span> The metrics below are simulated results computed using synthetic market parameters representing past scenarios. They do not constitute guaranteed returns or represent real, verified live performance on-chain.
                </div>
              </div>

              {/* Performance Metrics Cards Grid — ReactBits Compound Chassis */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {/* ROI */}
                <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
                  <div className="flex h-full flex-col justify-between rounded-lg bg-white p-4 transition-colors dark:bg-[#0a0a0a]">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted">ROI</span>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-accent dark:border-white/10 dark:bg-white/[0.04]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                      </div>
                    </div>
                    <span className={`mt-2 block font-mono text-xl font-bold tracking-tight ${result.metrics.roi >= 0 ? "text-positive" : "text-negative"}`}>
                      {result.metrics.roi >= 0 ? "+" : ""}{result.metrics.roi}%
                    </span>
                  </div>
                </div>

                {/* Win Rate */}
                <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
                  <div className="flex h-full flex-col justify-between rounded-lg bg-white p-4 transition-colors dark:bg-[#0a0a0a]">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted">Win Rate</span>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-positive dark:border-white/10 dark:bg-white/[0.04]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="6" />
                          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                        </svg>
                      </div>
                    </div>
                    <span className="mt-2 block font-mono text-xl font-bold tracking-tight text-foreground">
                      {result.metrics.winRate}%
                    </span>
                  </div>
                </div>

                {/* Sharpe Ratio */}
                <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
                  <div className="flex h-full flex-col justify-between rounded-lg bg-white p-4 transition-colors dark:bg-[#0a0a0a]">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted">Sharpe</span>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-purple-400 dark:border-white/10 dark:bg-white/[0.04]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                          <polyline points="16 7 22 7 22 13" />
                        </svg>
                      </div>
                    </div>
                    <span className="mt-2 block font-mono text-xl font-bold tracking-tight text-foreground">
                      {result.metrics.sharpe}
                    </span>
                  </div>
                </div>

                {/* Max Drawdown */}
                <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
                  <div className="flex h-full flex-col justify-between rounded-lg bg-white p-4 transition-colors dark:bg-[#0a0a0a]">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted">Drawdown</span>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-negative dark:border-white/10 dark:bg-white/[0.04]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </div>
                    </div>
                    <span className="mt-2 block font-mono text-xl font-bold tracking-tight text-negative">
                      -{result.metrics.maxDrawdown}%
                    </span>
                  </div>
                </div>

                {/* Trades Count */}
                <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838] col-span-2 sm:col-span-1">
                  <div className="flex h-full flex-col justify-between rounded-lg bg-white p-4 transition-colors dark:bg-[#0a0a0a]">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted">Trades</span>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-foreground-faint dark:border-white/10 dark:bg-white/[0.04]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m16 3 4 4-4 4" />
                          <path d="M20 7H4" />
                          <path d="m8 21-4-4 4-4" />
                          <path d="M4 17h16" />
                        </svg>
                      </div>
                    </div>
                    <span className="mt-2 block font-mono text-xl font-bold tracking-tight text-foreground">
                      {result.metrics.totalTrades}
                    </span>
                  </div>
                </div>
              </div>

              {/* Equity Curve SVG Line Chart */}
              {chartData && (
                <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                  <div className="flex flex-col gap-4 overflow-hidden rounded-lg bg-white p-5 dark:bg-[#0a0a0a]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Equity Performance Curve</h3>
                        <p className="text-xs text-foreground-muted mt-0.5">Account Net Asset Value over simulation steps</p>
                      </div>
                      {currentHoverPoint && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted block">Simulated Balance</span>
                          <span className="text-sm font-bold font-mono text-accent">${currentHoverPoint.equity.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="relative w-full h-[240px]">
                      <svg
                        ref={svgRef}
                        viewBox={`0 0 ${width} ${height}`}
                        className="w-full h-full overflow-visible select-none"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={() => setHoverIndex(null)}
                      >
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#14F195" stopOpacity="0.8"/>
                            <stop offset="100%" stopColor="#9945FF" stopOpacity="0.8"/>
                          </linearGradient>
                          <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#14F195" stopOpacity="0.2"/>
                            <stop offset="100%" stopColor="#9945FF" stopOpacity="0.0"/>
                          </linearGradient>
                        </defs>

                        {/* Y Axis Gridlines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                          const y = padding.top + ratio * (height - padding.top - padding.bottom);
                          const val = chartData.maxEq - ratio * (chartData.maxEq - chartData.minEq);
                          return (
                            <g key={i} className="opacity-20">
                              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeDasharray="3,3" />
                              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-foreground font-mono text-[9px]">${Math.round(val)}</text>
                            </g>
                          );
                        })}

                        {/* Gradient Filled Area */}
                        <path d={chartData.fillPath} fill="url(#fillGrad)" />

                        {/* Line Path */}
                        <path d={chartData.linePath} fill="none" stroke="url(#chartGrad)" strokeWidth="2.5" strokeLinecap="round" />

                        {/* Hover Interaction Indicator */}
                        {currentHoverPoint && (
                          <g>
                            <line
                              x1={currentHoverPoint.x}
                              y1={padding.top}
                              x2={currentHoverPoint.x}
                              y2={height - padding.bottom}
                              stroke="var(--foreground-muted)"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                            <circle
                              cx={currentHoverPoint.x}
                              cy={currentHoverPoint.y}
                              r="5"
                              className="fill-accent stroke-surface stroke-2"
                            />
                          </g>
                        )}
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic CTAs */}
              <div className="flex gap-4">
                <button
                  onClick={handleDeployRedirect}
                  className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-lg bg-accent text-accent-foreground font-semibold shadow-lg shadow-accent/20 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                >
                  <RocketIcon className="h-4 w-4" />
                  Deploy Agent with these Settings
                </button>
              </div>

              {/* Paginated Simulated Trade Log */}
              <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                <div className="flex flex-col gap-4 rounded-lg bg-white p-5 dark:bg-[#0a0a0a]">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-sm font-semibold text-foreground">Simulated Trades Log</h3>
                    <span className="text-xs text-foreground-muted font-mono">{result.trades.length} trades recorded</span>
                  </div>

                  {result.trades.length === 0 ? (
                    <p className="text-sm text-foreground-muted text-center py-6">No trades triggered during simulation. Try decreasing thresholds or widening window sizes.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="text-foreground-muted border-b border-black/5 pb-2 dark:border-white/5">
                              <th className="py-2 pr-4 whitespace-nowrap">Side</th>
                              <th className="py-2 pr-4 whitespace-nowrap">Entry Price</th>
                              <th className="py-2 pr-4 whitespace-nowrap">Exit Price</th>
                              <th className="py-2 pr-4 whitespace-nowrap">Realized PnL</th>
                              <th className="py-2 whitespace-nowrap">Rationale</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTrades.map((t, idx) => (
                              <tr key={idx} className="border-b border-black/5 transition-colors hover:bg-neutral-50 dark:border-white/5 dark:hover:bg-white/[0.02]">
                                <td className={`py-3 pr-4 font-semibold capitalize whitespace-nowrap ${t.side === "long" ? "text-positive" : "text-negative"}`}>
                                  {t.side}
                                </td>
                                <td className="py-3 pr-4 text-foreground whitespace-nowrap">${t.entryPrice.toFixed(2)}</td>
                                <td className="py-3 pr-4 text-foreground whitespace-nowrap">${t.exitPrice.toFixed(2)}</td>
                                <td className={`py-3 pr-4 font-semibold whitespace-nowrap ${t.realizedPnl >= 0 ? "text-positive" : "text-negative"}`}>
                                  {t.realizedPnl >= 0 ? "+" : ""}${t.realizedPnl}
                                </td>
                                <td className="py-3 text-foreground-muted min-w-[200px] max-w-[280px] truncate" title={`${t.entryReason} | ${t.exitReason}`}>
                                  {t.entryReason}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination buttons */}
                      {totalTradesPages > 1 && (
                        <div className="flex justify-center gap-2 mt-2">
                          <button
                            onClick={() => setTradesPage((p) => Math.max(1, p - 1))}
                            disabled={tradesPage === 1}
                            className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-surface text-foreground hover:bg-surface-hover hover:border-foreground-muted disabled:opacity-40 cursor-pointer"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                              <path d="m15 18-6-6 6-6" />
                            </svg>
                          </button>
                          <span className="text-xs text-foreground-muted flex items-center px-2">
                            Page {tradesPage} of {totalTradesPages}
                          </span>
                          <button
                            onClick={() => setTradesPage((p) => Math.min(totalTradesPages, p + 1))}
                            disabled={tradesPage === totalTradesPages}
                            className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-surface text-foreground hover:bg-surface-hover hover:border-foreground-muted disabled:opacity-40 cursor-pointer"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
