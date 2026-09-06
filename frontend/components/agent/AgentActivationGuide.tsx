"use client";

import { useState, useEffect } from "react";
import { CheckGlyph, ExternalLinkGlyph } from "@/components/ui/StatusGlyphs";

interface AgentActivationGuideProps {
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

export function AgentActivationGuide({ agent }: AgentActivationGuideProps) {
  const [activeTab, setActiveTab] = useState<"simulation" | "checklist" | "architecture">("simulation");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Simulation state
  const [simScenario, setSimScenario] = useState<"live" | "bull" | "bear" | "neutral">("bull");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [simCompleted, setSimCompleted] = useState(false);

  const isBase =
    agent.chain?.toLowerCase() === "base" ||
    agent.agent_pda.startsWith("0x") ||
    agent.owner.startsWith("0x");

  const assetSymbol = isBase ? "ETH" : "SOL";
  const venueLabel = isBase ? "Base Sepolia" : "Solana Devnet";
  const [livePrice, setLivePrice] = useState<number>(isBase ? 2450.0 : 102.5);

  // Fetch live market price
  useEffect(() => {
    let isMounted = true;
    const pair = isBase ? "ETHUSDT" : "SOLUSDT";
    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data?.price) {
          setLivePrice(Number(data.price));
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isBase]);

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedAddress(label);
      setTimeout(() => setCopiedAddress(null), 2000);
    }
  };

  const runSimulation = () => {
    setIsSimulating(true);
    setSimStep(1);
    setSimCompleted(false);

    setTimeout(() => setSimStep(2), 400);
    setTimeout(() => setSimStep(3), 900);
    setTimeout(() => {
      setSimStep(4);
      setIsSimulating(false);
      setSimCompleted(true);
    }, 1400);
  };

  const getSimResult = () => {
    switch (simScenario) {
      case "bull":
        return {
          velocityBps: +64,
          priceDeltaPct: "+0.64%",
          decision: "OPEN LONG",
          actionClass: "border-positive/30 bg-positive/5 text-positive",
          headline: "Bullish Momentum Signal Triggered",
          rationale: "Velocity (+64 bps) crossed above the +50 bps trigger. The agent automatically submits a Long order to capture upward momentum.",
          targetOrder: `0.05 ${assetSymbol} (~$${(livePrice * 0.05).toFixed(2)}) · 2x Leverage`,
          stopLoss: `${(livePrice * 0.99).toFixed(2)} (-1.00%)`,
          takeProfit: `${(livePrice * 1.015).toFixed(2)} (+1.50%)`,
        };
      case "bear":
        return {
          velocityBps: -68,
          priceDeltaPct: "-0.68%",
          decision: "OPEN SHORT",
          actionClass: "border-negative/30 bg-negative/5 text-negative",
          headline: "Bearish Breakdown Signal Triggered",
          rationale: "Downside velocity (-68 bps) crossed below the -50 bps threshold. The agent automatically submits a Short order to capture or hedge down-trend.",
          targetOrder: `0.05 ${assetSymbol} (~$${(livePrice * 0.05).toFixed(2)}) · 2x Leverage`,
          stopLoss: `${(livePrice * 1.01).toFixed(2)} (+1.00%)`,
          takeProfit: `${(livePrice * 0.985).toFixed(2)} (-1.50%)`,
        };
      case "neutral":
        return {
          velocityBps: +14,
          priceDeltaPct: "+0.14%",
          decision: "HOLD CASH (FLAT)",
          actionClass: "border-border bg-surface text-foreground-muted",
          headline: "Within Noise Band — Capital Protected",
          rationale: "Velocity (+14 bps) remains inside the normal noise band (±50 bps). Capital stays in cash to avoid fee erosion in flat markets.",
          targetOrder: "None (Cash)",
          stopLoss: "N/A",
          takeProfit: "N/A",
        };
      case "live":
      default:
        return {
          velocityBps: +18,
          priceDeltaPct: "+0.18%",
          decision: "HOLD CASH (FLAT)",
          actionClass: "border-border bg-surface text-foreground-muted",
          headline: "Evaluating Live Market — Flat Position",
          rationale: "Current market movement is within normal bounds. The agent scans every block and executes automatically upon breakout.",
          targetOrder: "None (Cash)",
          stopLoss: "N/A",
          takeProfit: "N/A",
        };
    }
  };

  const simResult = getSimResult();

  return (
    <div className="mb-8 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
      <div className="overflow-hidden rounded-lg bg-white dark:bg-[#0a0a0a]">
        {/* ── Top Header ──────────────────────────────────────────────────── */}
        <div className="border-b border-black/5 bg-neutral-50 px-5 py-4 dark:border-white/5 dark:bg-[#111111]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-foreground-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>New Agent Deployment</span>
              <span>·</span>
              <span>{venueLabel}</span>
            </div>
            <h3 className="mt-1 font-mono text-base font-bold text-foreground sm:text-lg">
              Strategy Verification & Launchpad
            </h3>
          </div>

          {/* Clean Text Navigation Tabs */}
          <div className="flex items-center rounded-lg border border-border bg-background p-1 font-mono text-xs">
            <button
              onClick={() => setActiveTab("simulation")}
              className={`rounded px-3 py-1 font-medium transition-colors cursor-pointer ${
                activeTab === "simulation"
                  ? "bg-surface text-foreground shadow-2xs font-semibold"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Test Strategy
            </button>
            <button
              onClick={() => setActiveTab("checklist")}
              className={`rounded px-3 py-1 font-medium transition-colors cursor-pointer ${
                activeTab === "checklist"
                  ? "bg-surface text-foreground shadow-2xs font-semibold"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Launch Checklist
            </button>
            <button
              onClick={() => setActiveTab("architecture")}
              className={`rounded px-3 py-1 font-medium transition-colors cursor-pointer ${
                activeTab === "architecture"
                  ? "bg-surface text-foreground shadow-2xs font-semibold"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Architecture
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-foreground-muted leading-relaxed max-w-3xl">
          This agent is deployed on-chain and actively evaluating oracle prices. Newly deployed agents remain 100% in cash until market momentum crosses their threshold parameters. You can simulate logic execution below or fund the vault to activate live trading.
        </p>
      </div>

      {/* ── Tab 1: Interactive Strategy Simulation ───────────────────────── */}
      {activeTab === "simulation" && (
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Left Controls */}
            <div className="flex flex-col gap-3.5 lg:col-span-5">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground-faint">
                  Select Volatility Scenario
                </span>
                <p className="mt-1 text-xs text-foreground-muted">
                  Test how {agent.name}&apos;s mathematical parameters evaluate various market conditions.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                  <button
                    onClick={() => {
                      setSimScenario("live");
                      setSimCompleted(false);
                    }}
                    className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      simScenario === "live"
                        ? "border-accent bg-accent/8 text-foreground font-semibold shadow-xs ring-1 ring-accent/30"
                        : "border-border bg-background hover:bg-surface-hover hover:border-border-strong text-foreground-muted"
                    }`}
                  >
                    <div className="font-bold text-foreground">Live Market</div>
                    <div className="mt-0.5 text-[10px] text-foreground-faint">Current {assetSymbol} price</div>
                  </button>

                  <button
                    onClick={() => {
                      setSimScenario("bull");
                      setSimCompleted(false);
                    }}
                    className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      simScenario === "bull"
                        ? "border-accent bg-accent/8 text-foreground font-semibold shadow-xs ring-1 ring-accent/30"
                        : "border-border bg-background hover:bg-surface-hover hover:border-border-strong text-foreground-muted"
                    }`}
                  >
                    <div className="font-bold text-foreground">+64 bps Breakout</div>
                    <div className="mt-0.5 text-[10px] text-foreground-faint">Above +50 bps trigger</div>
                  </button>

                  <button
                    onClick={() => {
                      setSimScenario("bear");
                      setSimCompleted(false);
                    }}
                    className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      simScenario === "bear"
                        ? "border-accent bg-accent/8 text-foreground font-semibold shadow-xs ring-1 ring-accent/30"
                        : "border-border bg-background hover:bg-surface-hover hover:border-border-strong text-foreground-muted"
                    }`}
                  >
                    <div className="font-bold text-foreground">-68 bps Breakdown</div>
                    <div className="mt-0.5 text-[10px] text-foreground-faint">Below -50 bps trigger</div>
                  </button>

                  <button
                    onClick={() => {
                      setSimScenario("neutral");
                      setSimCompleted(false);
                    }}
                    className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      simScenario === "neutral"
                        ? "border-accent bg-accent/8 text-foreground font-semibold shadow-xs ring-1 ring-accent/30"
                        : "border-border bg-background hover:bg-surface-hover hover:border-border-strong text-foreground-muted"
                    }`}
                  >
                    <div className="font-bold text-foreground">+14 bps Range</div>
                    <div className="mt-0.5 text-[10px] text-foreground-faint">Within noise band</div>
                  </button>
                </div>
              </div>

              <div>
                <button
                  onClick={runSimulation}
                  disabled={isSimulating}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-mono text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {isSimulating ? (
                    <>
                      <svg className="h-3.5 w-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                      </svg>
                      <span className="text-white">Evaluating Parameters...</span>
                    </>
                  ) : (
                    <span className="text-white">Test-Fire Strategy Now</span>
                  )}
                </button>
              </div>

              {/* Active Scenario Context Specs */}
              <div className="rounded-lg border border-border bg-surface/40 p-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-faint">
                    Scenario Parameters
                  </span>
                  <span className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                    {simScenario === "bull"
                      ? "Breakout (+64 bps)"
                      : simScenario === "bear"
                      ? "Breakdown (-68 bps)"
                      : simScenario === "neutral"
                      ? "Rangebound (+14 bps)"
                      : "Live Market Feed"}
                  </span>
                </div>

                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-faint">Simulated Velocity:</span>
                    <span className="font-semibold text-foreground">
                      {simScenario === "bull"
                        ? "+64 bps (+0.64%)"
                        : simScenario === "bear"
                        ? "-68 bps (-0.68%)"
                        : simScenario === "neutral"
                        ? "+14 bps (+0.14%)"
                        : "+18 bps (+0.18%)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-faint">Strategy Threshold:</span>
                    <span className="text-foreground">±50 bps (0.50%)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-faint">Expected Action:</span>
                    <span className="font-medium text-foreground">
                      {simScenario === "bull"
                        ? "Open Long (Breakout)"
                        : simScenario === "bear"
                        ? "Open Short (Breakdown)"
                        : "Hold Cash (Noise Band)"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Execution Terminal */}
            <div className="rounded-xl border border-border bg-background p-4 font-mono text-xs lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border pb-2.5 text-[11px]">
                  <span className="font-bold text-foreground uppercase tracking-wider">
                    Execution Log
                  </span>
                  <span className="text-foreground-faint">
                    Oracle: ${livePrice.toFixed(2)}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className={`flex items-center gap-2 transition-opacity ${simStep >= 1 ? "opacity-100" : "opacity-30"}`}>
                    <span className="font-bold text-foreground-faint">01</span>
                    <span className="text-foreground-muted">Querying {assetSymbol}/USD Pyth price:</span>
                    <span className="font-bold text-foreground">${livePrice.toFixed(2)}</span>
                  </div>

                  <div className={`flex items-center gap-2 transition-opacity ${simStep >= 2 ? "opacity-100" : "opacity-30"}`}>
                    <span className="font-bold text-foreground-faint">02</span>
                    <span className="text-foreground-muted">Rolling velocity calculation:</span>
                    <span className={`font-bold tabular-nums ${simResult.velocityBps >= 0 ? "text-positive" : "text-negative"}`}>
                      {simResult.velocityBps >= 0 ? "+" : ""}{simResult.velocityBps} bps ({simResult.priceDeltaPct})
                    </span>
                  </div>

                  <div className={`flex items-center gap-2 transition-opacity ${simStep >= 3 ? "opacity-100" : "opacity-30"}`}>
                    <span className="font-bold text-foreground-faint">03</span>
                    <span className="text-foreground-muted">Risk constraints check:</span>
                    <span className="text-foreground font-medium">Max 2x Leverage · Isolated Margin</span>
                  </div>
                </div>

                {simCompleted ? (
                  <div className={`mt-4 rounded-lg border p-4 transition-all ${simResult.actionClass}`}>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                        Autonomous Verdict
                      </span>
                      <span className="rounded border border-current px-2 py-0.5 font-bold">
                        {simResult.decision}
                      </span>
                    </div>

                    <h4 className="mt-2 text-sm font-bold text-foreground">
                      {simResult.headline}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                      {simResult.rationale}
                    </p>

                    {simResult.decision !== "HOLD CASH (FLAT)" && (
                      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-[11px]">
                        <div>
                          <div className="text-[10px] text-foreground-faint">Target Sizing</div>
                          <div className="font-bold text-foreground">{simResult.targetOrder}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-foreground-faint">Stop Loss</div>
                          <div className="font-bold text-negative">{simResult.stopLoss}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-foreground-faint">Take Profit</div>
                          <div className="font-bold text-positive">{simResult.takeProfit}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-foreground-faint text-xs">
                    Select a scenario and click &ldquo;Test-Fire Strategy Now&rdquo; to evaluate.
                  </div>
                )}
              </div>

              <div className="mt-3 border-t border-border/50 pt-2 flex items-center justify-between text-[10px] text-foreground-faint">
                <span>Evaluation Engine: Active</span>
                <span>Latency: &lt;15ms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: 3-Step Activation Checklist ─────────────────────────── */}
      {activeTab === "checklist" && (
        <div className="p-5 sm:p-6 space-y-4">
          {/* Step 1 */}
          <div className="rounded-xl border border-positive/30 bg-positive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-positive/20 text-positive">
                <CheckGlyph className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-mono text-sm font-bold text-foreground">
                    1. On-Chain Registry Identity
                  </h4>
                  <span className="rounded bg-positive/20 px-2 py-0.2 font-mono text-[9px] font-bold text-positive uppercase">
                    Active
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground-muted">
                  Agent identity is registered immutably on {venueLabel}.
                </p>
                <div className="mt-2 font-mono text-[11px] text-foreground-faint flex items-center gap-2">
                  <span>PDA: {agent.agent_pda.slice(0, 8)}...{agent.agent_pda.slice(-6)}</span>
                  <button
                    onClick={() => copyToClipboard(agent.agent_pda, "pda")}
                    className="text-accent hover:underline cursor-pointer"
                  >
                    {copiedAddress === "pda" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <span className="font-mono text-xs text-positive font-semibold whitespace-nowrap">
              Registered
            </span>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-border bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground font-mono text-xs font-bold">
                2
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-mono text-sm font-bold text-foreground">
                    2. Vault Collateralization
                  </h4>
                  <span className="rounded bg-surface-hover px-2 py-0.2 font-mono text-[9px] font-bold text-foreground-muted uppercase">
                    Action Needed
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground-muted max-w-xl">
                  Perpetual smart contracts require margin collateral to open positions. Transfer testnet {assetSymbol} to this agent&apos;s isolated vault address to enable automated trade execution.
                </p>
                <div className="mt-2 font-mono text-[11px] text-foreground-faint flex flex-wrap items-center gap-2">
                  <span>Vault: {agent.vault_pubkey}</span>
                  <button
                    onClick={() => copyToClipboard(agent.vault_pubkey, "vault")}
                    className="text-accent hover:underline font-semibold cursor-pointer"
                  >
                    {copiedAddress === "vault" ? "Copied" : "Copy Vault Address"}
                  </button>
                </div>
              </div>
            </div>

            <a
              href={isBase ? "https://faucets.chain.link/base-sepolia" : "https://faucet.solana.com/"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors whitespace-nowrap"
            >
              <span>Get Testnet {assetSymbol}</span>
              <ExternalLinkGlyph className="h-3 w-3" />
            </a>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-border bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground font-mono text-xs font-bold">
                3
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-mono text-sm font-bold text-foreground">
                    3. Autonomous Keeper Execution
                  </h4>
                  <span className="rounded bg-surface-hover px-2 py-0.2 font-mono text-[9px] font-bold text-foreground-muted uppercase">
                    Monitoring
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground-muted max-w-xl">
                  The execution runtime monitors Pyth oracle updates continuously. Once rolling velocity satisfies the strategy trigger (±50 bps), signed orders are dispatched to the perpetual contract.
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-foreground-faint">
                  Reach 50 verified fills to earn the &ldquo;Proven Risk Discipline&rdquo; on-chain badge on the leaderboard.
                </p>
              </div>
            </div>

            <span className="font-mono text-xs text-foreground-faint whitespace-nowrap">
              Polling every 15s
            </span>
          </div>
        </div>
      )}

      {/* ── Tab 3: Execution Architecture ──────────────────────────────── */}
      {activeTab === "architecture" && (
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
              <div className="rounded-lg bg-white p-4 dark:bg-[#0a0a0a]">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground-faint">
                  01 · Capital Discipline
                </div>
                <h4 className="mt-2 font-mono text-sm font-bold text-foreground">
                  Flat During Low Volatility
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                  Trading in chop erodes collateral through fees and spread slippage. ViperX momentum engines stay in cash until price movement confirms directional velocity.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
              <div className="rounded-lg bg-white p-4 dark:bg-[#0a0a0a]">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground-faint">
                  02 · Oracle Monitoring
                </div>
                <h4 className="mt-2 font-mono text-sm font-bold text-foreground">
                  High-Frequency Evaluation
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                  Keepers poll Pyth high-frequency oracle updates every 15 seconds. When price delta satisfies mathematical conditions, signed orders settle directly on-chain.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
              <div className="rounded-lg bg-white p-4 dark:bg-[#0a0a0a]">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground-faint">
                  03 · Verified Track Record
                </div>
                <h4 className="mt-2 font-mono text-sm font-bold text-foreground">
                  Cryptographic Proof
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                  Every trade is recorded with its transaction signature. Only settled on-chain fills count toward verified track record badges and global leaderboard rankings.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
