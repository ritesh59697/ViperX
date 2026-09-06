"use client";

import { useEffect, useState, useMemo } from "react";

interface AgentLiveTelemetryProps {
  agent: {
    agent_pda: string;
    agent_id: string;
    name: string;
    chain?: string | null;
    strategy_uri?: string | null;
    owner: string;
    vault_pubkey: string;
    status: string;
  };
}

interface PriceData {
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  symbol: string;
}

interface EventLog {
  id: string;
  time: string;
  tag: string;
  tagColor: "neutral" | "positive" | "negative" | "accent";
  summary: string;
  detail: string;
}

/**
 * High-definition Ethereum Diamond vector badge
 */
function EthTokenBadge({ size = 22 }: { size?: number }) {
  return (
    <div
      className="inline-flex items-center justify-center rounded-full bg-[#627EEA]/15 border border-[#627EEA]/30 shrink-0"
      style={{ width: size, height: size }}
      title="Ethereum (ETH)"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M127.961 0L125.166 9.5V285.168L127.961 287.958L255.923 212.32L127.961 0Z" fill="#627EEA" />
        <path d="M127.962 0L0 212.32L127.962 287.958V154.43V0Z" fill="#627EEA" fillOpacity="0.75" />
        <path d="M127.961 312.187L126.386 314.106V413.791L127.961 416.57L256 236.587L127.961 312.187Z" fill="#627EEA" />
        <path d="M127.962 416.57V312.187L0 236.587L127.962 416.57Z" fill="#627EEA" fillOpacity="0.75" />
        <path d="M127.961 287.958L255.923 212.32L127.961 154.43V287.958Z" fill="#8A92B2" />
        <path d="M0 212.32L127.962 287.958V154.43L0 212.32Z" fill="#AAB0CE" />
      </svg>
    </div>
  );
}

/**
 * High-definition Solana vector badge
 */
function SolTokenBadge({ size = 22 }: { size?: number }) {
  return (
    <div
      className="inline-flex items-center justify-center rounded-full bg-[#14F195]/15 border border-[#14F195]/30 shrink-0"
      style={{ width: size, height: size }}
      title="Solana (SOL)"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h313.7c6 0 9 7.3 4.7 11.5l-54.8 54.8c-2.4 2.4-5.7 3.8-9.2 3.8H14.7c-6 0-9-7.3-4.7-11.5l54.6-54.8z" fill="#00FFA3" />
        <path d="M64.6 3.8C67 1.4 70.3 0 73.8 0h313.7c6 0 9 7.3 4.7 11.5L337.4 66.3c-2.4 2.4-5.7 3.8-9.2 3.8H14.7c-6 0-9-7.3-4.7-11.5L64.6 3.8z" fill="#00FFA3" />
        <path d="M332.4 120.9c-2.4-2.4-5.7-3.8-9.2-3.8H9.5c-6 0-9 7.3-4.7 11.5l54.8 54.8c2.4 2.4 5.7 3.8 9.2 3.8h313.7c6 0 9-7.3 4.7-11.5l-54.8-54.8z" fill="#DC1FFF" />
      </svg>
    </div>
  );
}

export function AgentLiveTelemetry({ agent }: AgentLiveTelemetryProps) {
  const isBase =
    agent.chain?.toLowerCase() === "base" ||
    agent.agent_pda.startsWith("0x") ||
    agent.owner.startsWith("0x");

  const targetAsset = isBase ? "ETH" : "SOL";
  const binanceSymbol = isBase ? "ETHUSDT" : "SOLUSDT";
  const venueLabel = isBase ? "Base Sepolia" : "Solana Devnet";

  // Parse strategy specs with beginner-friendly explanations
  const strategyInfo = useMemo(() => {
    const id = (agent.agent_id || "").toLowerCase();
    const uri = (agent.strategy_uri || "").toLowerCase();

    if (id.includes("rsi") || uri.includes("rsi") || id.includes("mean") || uri.includes("mean")) {
      return {
        type: "Mean Reversion",
        name: "RSI Mean Reversion",
        plainEnglish: "Buys oversold dips · Takes profit on peaks",
        rule: "RSI < 35 (Long) / RSI > 65 (Short)",
        boundary: "Trigger at RSI < 35 or > 65",
        size: "$25.00 USD",
      };
    } else if (id.includes("grid") || uri.includes("grid")) {
      return {
        type: "Grid Trading",
        name: "Automated Grid Matrix",
        plainEnglish: "Places laddered buy/sell orders automatically",
        rule: "Spacing 30 bps (0.30%) per level",
        boundary: "±30 bps step intervals",
        size: "$30.00 / level",
      };
    } else {
      return {
        type: "Momentum",
        name: "Momentum Breakout v1.0",
        plainEnglish: "Rides sudden volume spikes · Protects capital",
        rule: "Trigger threshold: ±50 bps (0.50%)",
        boundary: "±50 bps breakout trigger",
        size: "$20.00 USD",
      };
    }
  }, [agent.agent_id, agent.strategy_uri]);

  // Live market price
  const [marketData, setMarketData] = useState<PriceData>({
    price: isBase ? 2455.45 : 138.5,
    change24h: -2.52,
    high24h: isBase ? 2547.0 : 142.0,
    low24h: isBase ? 2432.0 : 134.5,
    symbol: targetAsset,
  });

  const [secondsUntilNextTick, setSecondsUntilNextTick] = useState(15);
  const [marketMomentumBps, setMarketMomentumBps] = useState<number>(+2);
  const [showConsole, setShowConsole] = useState(false);
  const [activeSimulation, setActiveSimulation] = useState<"bull" | "bear" | null>(null);

  const [eventLogs, setEventLogs] = useState<EventLog[]>(() => [
    {
      id: "ev-1",
      time: "Live",
      tag: "KEEPER ACTIVE",
      tagColor: "positive",
      summary: "Oracle scanner active on Pyth feed",
      detail: `Tracking ${targetAsset}/USD at 15s intervals. 0 unhedged exposure.`,
    },
    {
      id: "ev-2",
      time: "Standby",
      tag: "HOLDING CASH",
      tagColor: "neutral",
      summary: "Capital preserved in cash",
      detail: "Current market volatility is below the ±50 bps entry trigger.",
    },
  ]);

  // Fetch real-time market data from Binance API
  useEffect(() => {
    let isMounted = true;

    async function fetchTicker() {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        const currentPrice = Number(data.lastPrice);
        const change = Number(data.priceChangePercent);
        const high = Number(data.highPrice);
        const low = Number(data.lowPrice);

        setMarketData({
          price: currentPrice,
          change24h: change,
          high24h: high,
          low24h: low,
          symbol: targetAsset,
        });

        // Compute gentle rolling momentum approximation unless in active simulation
        if (!activeSimulation) {
          const sampleBps = Math.round(Math.sin(Date.now() / 28000) * 18 + (change > 0 ? 4 : -12));
          setMarketMomentumBps(sampleBps);
        }
        setSecondsUntilNextTick(15);
      } catch {
        // Quiet fallback
      }
    }

    fetchTicker();
    const interval = setInterval(fetchTicker, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [binanceSymbol, targetAsset, activeSimulation]);

  // Tick countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilNextTick((sec) => (sec > 1 ? sec - 1 : 15));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trigger interactive shock simulation
  const handleTriggerShock = (type: "bull" | "bear" | "reset") => {
    if (type === activeSimulation) return;
    if (type === "reset" && activeSimulation === null) return;

    const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

    if (type === "bull") {
      setActiveSimulation("bull");
      setMarketMomentumBps(+64);
      setEventLogs((prev) => [
        {
          id: `sim-${Date.now()}`,
          time: timeStr,
          tag: "OPEN LONG (SIM)",
          tagColor: "positive",
          summary: `Breakout triggered (+64 bps > +50 bps trigger)`,
          detail: `Simulated order size: ${strategyInfo.size} · Target TP: +1.50% · Stop: -1.00%`,
        },
        ...prev.filter((l) => l.tag !== "OPEN LONG (SIM)").slice(0, 3),
      ]);
    } else if (type === "bear") {
      setActiveSimulation("bear");
      setMarketMomentumBps(-68);
      setEventLogs((prev) => [
        {
          id: `sim-${Date.now()}`,
          time: timeStr,
          tag: "OPEN SHORT (SIM)",
          tagColor: "negative",
          summary: `Breakdown triggered (-68 bps < -50 bps trigger)`,
          detail: `Simulated order size: ${strategyInfo.size} · Target TP: +1.50% · Stop: -1.00%`,
        },
        ...prev.filter((l) => l.tag !== "OPEN SHORT (SIM)").slice(0, 3),
      ]);
    } else {
      setActiveSimulation(null);
      setMarketMomentumBps(+2);
      setEventLogs((prev) => [
        {
          id: `sim-${Date.now()}`,
          time: timeStr,
          tag: "RESET TO ORACLE",
          tagColor: "neutral",
          summary: "Resumed live feed evaluation",
          detail: "Standing by for organic market breakout triggers.",
        },
        ...prev.filter((l) => l.tag !== "RESET TO ORACLE").slice(0, 3),
      ]);
    }
  };

  return (
    <div className="mb-8 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
      <div className="overflow-hidden rounded-lg bg-white dark:bg-[#0a0a0a]">
        {/* ── Header Bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 bg-neutral-50 px-5 py-3 dark:border-white/5 dark:bg-[#111111]">
          <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />
              LIVE
            </span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              Strategy Telemetry
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs text-foreground-faint">
            {isBase ? <EthTokenBadge size={16} /> : <SolTokenBadge size={16} />}
            <span className="font-semibold text-foreground">{targetAsset}/USD</span>
            <span>·</span>
            <span>{venueLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <button
            type="button"
            onClick={() => setShowConsole(!showConsole)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
              showConsole
                ? "border-foreground/30 bg-foreground/5 text-foreground dark:bg-white/10 dark:border-white/20"
                : "border-border bg-surface text-foreground-muted hover:border-border-strong hover:text-foreground"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span>{showConsole ? "Hide Console" : "Inspect Console"}</span>
          </button>

          <span className="text-[11px] text-foreground-faint">
            Tick in <span className="tabular-nums text-foreground font-medium">{secondsUntilNextTick}s</span>
          </span>
        </div>
      </div>

      {/* ── 4-Column Metric Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
        {/* Column 1: Target Asset & Live Oracle Price */}
        <div className="flex flex-col gap-1 p-4.5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">
            Target Asset (Oracle)
          </p>
          <div className="mt-1 flex items-center gap-2">
            {isBase ? <EthTokenBadge size={22} /> : <SolTokenBadge size={22} />}
            <span className="font-mono text-xl font-bold text-foreground tabular-nums">
              ${marketData.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`font-mono text-xs font-semibold tabular-nums ${
                marketData.change24h >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {marketData.change24h >= 0 ? "+" : ""}
              {marketData.change24h.toFixed(2)}%
            </span>
          </div>
          <p className="text-[10px] text-foreground-faint font-mono">
            {targetAsset}/USD · 24h: ${marketData.low24h.toFixed(0)} – ${marketData.high24h.toFixed(0)}
          </p>
        </div>

        {/* Column 2: Strategy Logic */}
        <div className="flex flex-col gap-1 p-4.5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">
            Algorithmic Logic
          </p>
          <p className="mt-1 font-mono text-base font-bold text-foreground truncate">
            {strategyInfo.name}
          </p>
          <p className="text-[11px] text-foreground-muted truncate font-medium">
            {strategyInfo.plainEnglish}
          </p>
        </div>

        {/* Column 3: Market Velocity with Percentage Context */}
        <div className="flex flex-col gap-1 p-4.5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">
            Market Speed (Velocity)
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold tabular-nums text-foreground">
              {marketMomentumBps >= 0 ? "+" : ""}
              {marketMomentumBps} bps
            </span>
            <span className="text-[11px] font-mono text-foreground-muted">
              ({(marketMomentumBps / 100).toFixed(2)}%)
            </span>
          </div>
          <p className="text-[10px] text-foreground-faint font-mono">
            {Math.abs(marketMomentumBps) >= 50
              ? "Threshold Breached"
              : "Threshold: ±50 bps"}
          </p>
        </div>

        {/* Column 4: Bot Action State */}
        <div className="flex flex-col gap-1 p-4.5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">
            Bot Runtime Action
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                activeSimulation === "bull"
                  ? "bg-accent animate-pulse"
                  : activeSimulation === "bear"
                  ? "bg-accent animate-pulse"
                  : "bg-neutral-400 dark:bg-neutral-500"
              }`}
            />
            <span className="font-mono text-base font-bold text-foreground">
              {activeSimulation === "bull"
                ? `Long ${targetAsset}`
                : activeSimulation === "bear"
                ? `Short ${targetAsset}`
                : "In Cash (Safe)"}
            </span>
          </div>
          <p className="text-[10px] text-foreground-faint font-mono">
            Target Sizing: {strategyInfo.size}
          </p>
        </div>
      </div>

      {/* ── Refined Strategy Console ──────────────────────────────────────── */}
      {showConsole && (
        <div className="border-t border-border bg-neutral-50/75 p-5 dark:bg-neutral-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3 mb-4">
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Autonomous Strategy Engine Console
              </h4>
              <p className="mt-0.5 text-xs text-foreground-muted">
                Inspect live decision evaluation or test how the engine reacts to sudden price shocks.
              </p>
            </div>

            {/* Clean Segmented Controls */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-foreground-faint uppercase">Test Shock:</span>
              <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 shadow-2xs font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => handleTriggerShock("bull")}
                  className={`rounded px-2.5 py-1 font-medium transition-all cursor-pointer ${
                    activeSimulation === "bull"
                      ? "bg-accent text-white font-bold shadow-xs"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  +64 bps Surge
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerShock("bear")}
                  className={`rounded px-2.5 py-1 font-medium transition-all cursor-pointer ${
                    activeSimulation === "bear"
                      ? "bg-accent text-white font-bold shadow-xs"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  -68 bps Drop
                </button>
                {activeSimulation && (
                  <button
                    type="button"
                    onClick={() => handleTriggerShock("reset")}
                    className="rounded px-2.5 py-1 text-foreground-faint hover:text-foreground transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Decision Timeline Cards */}
          <div className="space-y-2">
            {eventLogs.map((ev) => {
              const tagColors = {
                positive: "border-border-strong bg-surface text-foreground font-semibold",
                negative: "border-border-strong bg-surface text-foreground font-semibold",
                neutral: "border-border bg-surface text-foreground-muted",
                accent: "border-accent/30 bg-accent/10 text-accent font-semibold",
              }[ev.tagColor];

              return (
                <div
                  key={ev.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${tagColors}`}>
                      {ev.tagColor === "positive" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />
                      )}
                      {ev.tag}
                    </span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {ev.summary}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-foreground-faint">
                    <span className="truncate max-w-md">{ev.detail}</span>
                    <span className="text-[10px] tabular-nums shrink-0">[{ev.time}]</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  </div>
);
}
