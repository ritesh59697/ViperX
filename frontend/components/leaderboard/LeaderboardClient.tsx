"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchLeaderboard,
  isBlockedAgent,
  LEADERBOARD_WINDOWS,
  LeaderboardAgent,
  LeaderboardWindow,
  getAgentChain,
} from "@/lib/leaderboardApi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { XGlyph, InfoGlyph, CheckGlyph, ArrowRightGlyph } from "@/components/ui/StatusGlyphs";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { StaggerTableBody, StaggerRow } from "@/components/motion/StaggerTable";

const MIN_TRADES_FOR_ELIGIBILITY = 50;

function truncate(address: string): string {
  return `${address.slice(0, 4)}..${address.slice(-4)}`;
}

function formatMetric(value: string | null, suffix = ""): string {
  if (value === null) return "N/A";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}${suffix}` : "N/A";
}

function signClass(value: string | null): string {
  if (value === null) return "text-foreground-faint";
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "text-foreground";
  return n > 0 ? "text-positive" : "text-negative";
}

const TH = "px-4 py-3 font-medium";
const TD = "px-4 py-3.5";

interface LeaderboardClientProps {
  initialWindow: LeaderboardWindow;
  initialAgents: LeaderboardAgent[];
  initialError: string | null;
}

export function LeaderboardClient({
  initialWindow,
  initialAgents,
  initialError,
}: LeaderboardClientProps) {
  const [selectedWindow, setSelectedWindow] = useState<LeaderboardWindow>(initialWindow);
  const [activeChain, setActiveChain] = useState<"base" | "solana">("base");
  const [cache, setCache] = useState<Partial<Record<LeaderboardWindow, LeaderboardAgent[]>>>({
    [initialWindow]: initialAgents,
  });
  const [isSwitching, setIsSwitching] = useState(false);
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const saved = localStorage.getItem("viperx-active-chain");
      if (saved === "solana" || saved === "base") {
        setActiveChain(saved as "base" | "solana");
      } else {
        setActiveChain("base");
      }
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("viperx-chain-changed", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("viperx-chain-changed", update);
    };
  }, []);

  // Background pre-fetch of remaining windows so clicking is always instant (0ms) and never errors
  useEffect(() => {
    const windowsToPrefetch = LEADERBOARD_WINDOWS.filter((w) => w !== initialWindow);
    windowsToPrefetch.forEach(async (w) => {
      try {
        const res = await fetch(`/api/leaderboard?window=${w}`);
        if (res.ok) {
          const json = await res.json();
          const filtered = (json.agents || []).filter((a: LeaderboardAgent) => !isBlockedAgent(a));
          setCache((prev) => ({ ...prev, [w]: filtered }));
        } else {
          const fallback = await fetchLeaderboard(w);
          const filtered = (fallback.agents || []).filter((a) => !isBlockedAgent(a));
          setCache((prev) => ({ ...prev, [w]: filtered }));
        }
      } catch {
        // Silent fallback in background
      }
    });
  }, [initialWindow]);

  const handleWindowChange = useCallback(
    async (w: LeaderboardWindow) => {
      if (w === selectedWindow) return;
      setSelectedWindow(w);

      // Update URL query parameter shallowly
      const url = new URL(window.location.href);
      url.searchParams.set("window", w);
      window.history.replaceState(null, "", url.toString());

      // If already cached in memory, switch instantly (0ms)
      if (cache[w]) {
        return;
      }

      setIsSwitching(true);
      try {
        const res = await fetch(`/api/leaderboard?window=${w}`);
        if (res.ok) {
          const json = await res.json();
          const filtered = (json.agents || []).filter((a: LeaderboardAgent) => !isBlockedAgent(a));
          setCache((prev) => ({ ...prev, [w]: filtered }));
        } else {
          const fallback = await fetchLeaderboard(w);
          const filtered = (fallback.agents || []).filter((a) => !isBlockedAgent(a));
          setCache((prev) => ({ ...prev, [w]: filtered }));
        }
      } catch (err) {
        console.error("Window switch fetch error:", err);
        // Retain existing data gracefully so user never sees a broken screen
      } finally {
        setIsSwitching(false);
      }
    },
    [selectedWindow, cache]
  );

  const rawAgents = cache[selectedWindow] ?? cache[initialWindow] ?? [];
  const agents = rawAgents.filter((a) => getAgentChain(a) === activeChain);
  const ranked = agents.filter((a) => a.onchain_verified);
  const pending = agents.filter((a) => !a.onchain_verified);

  return (
    <div>
      {/* ── Page Header matching ViperX theme ── */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="t-label">Leaderboard</span>
          <h1 className="t-h2 mt-3 text-foreground">Ranked by risk-adjusted return</h1>
          <p className="t-body mt-2 max-w-[58ch] text-sm text-foreground-muted">
            A rank requires {MIN_TRADES_FOR_ELIGIBILITY} fills the indexer confirmed
            against on-chain position state, and only those fills score. Sorted on a
            volatility-adjusted Sharpe, not raw PNL, with wash-trading patterns flagged
            automatically.
          </p>
        </div>

        {/* Action button on top right: Purely Deploy an agent */}
        <Button href="/create">Deploy an agent</Button>
      </div>

      {/* ── Timeframe & Chain Bar: Timeframe pills on left, Chain dropdown & metadata on right ── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Timeframe pills */}
        <div className="flex flex-wrap gap-2">
          {LEADERBOARD_WINDOWS.map((w) => (
            <Button
              key={w}
              variant="secondary"
              active={w === selectedWindow}
              onClick={() => handleWindowChange(w)}
            >
              {w === "all" ? "All time" : w}
            </Button>
          ))}
        </div>

        {/* Right: How ranking works and Agent count */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsRankingModalOpen(true)}
            className="group inline-flex items-center gap-2 text-xs text-foreground-faint transition-colors hover:text-foreground cursor-pointer"
          >
            <InfoGlyph className="h-3.5 w-3.5 shrink-0 text-foreground-faint transition-colors group-hover:text-accent" />
            <span className="underline decoration-border-strong underline-offset-4 transition-colors group-hover:decoration-accent">
              How ranking works
            </span>
          </button>
          <span className="text-border-strong select-none">•</span>
          <span className="font-mono text-xs text-foreground-faint">
            {ranked.length > 0
              ? `${ranked.length} ranked agent${ranked.length === 1 ? "" : "s"}`
              : `${pending.length} active agent${pending.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>

      {initialError && (
        <Card variant="error" className="mt-6">
          Couldn&apos;t reach leaderboard-api: {initialError}
        </Card>
      )}

      {/* ── Content Area: Matches Image 1 with soft translucent borders ── */}
      <div className={`mt-6 transition-opacity duration-150 ${isSwitching ? "opacity-75" : "opacity-100"}`}>
        {/* Helper Hint Bar (Removed, merged into table header) */}

        {/* Ranked Table (when agents qualify) */}
        {ranked.length > 0 && (
          <div className="surface overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="t-label border-b border-border">
                  <tr>
                    <th className={TH}>#</th>
                    <th className={TH}>
                      <div className="flex items-center gap-1.5">
                        Agent
                        <InfoTooltip position="bottom" align="left" content="Click any agent to inspect verified fills, Sharpe metrics, and live copy trading." />
                      </div>
                    </th>
                    <th className={TH}>Owner</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Trades</th>
                    <th className={`${TH} text-right`}>Sharpe</th>
                    <th className={`${TH} text-right`}>ROI</th>
                    <th className={`${TH} text-right`}>Max DD</th>
                    <th className={`${TH} text-right`}>Profile</th>
                  </tr>
                </thead>
                <StaggerTableBody className="divide-y divide-border">
                  {ranked.map((agent) => (
                    <StaggerRow key={agent.agent_pda} className="transition-colors hover:bg-surface">
                      <td className={`${TD} font-mono text-xs tabular-nums text-foreground-faint`}>
                        {agent.rank}
                      </td>
                      <td className={TD}>
                        <Link
                          href={`/agents/${agent.agent_pda}`}
                          prefetch={true}
                          className="group inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-accent"
                        >
                          <span className="group-hover:underline underline-offset-4 decoration-accent/60">
                            {agent.name}
                          </span>
                          <ArrowRightGlyph className="h-3 w-3 text-foreground-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                        </Link>
                        <div className="font-mono text-[0.6875rem] text-foreground-faint">
                          {agent.agent_id}
                        </div>
                        {agent.wash_trading_flagged && (
                          <span
                            className="mt-1 inline-block text-[0.6875rem] font-medium text-negative"
                            title={agent.flagged_reason || "Flagged for wash trading patterns"}
                          >
                            Flagged
                          </span>
                        )}
                      </td>
                      <td className={`${TD} font-mono text-xs text-foreground-muted`}>
                        {truncate(agent.owner)}
                      </td>
                      <td className={TD}>
                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              agent.status === "Active" ? "bg-positive" : "bg-foreground-faint"
                            }`}
                          />
                          {agent.status}
                        </span>
                      </td>
                      <td className={`${TD} font-mono text-xs text-foreground-muted`}>
                        {agent.trade_count}
                      </td>
                      <td className={`${TD} text-right font-mono text-xs font-medium tabular-nums text-foreground`}>
                        {formatMetric(agent.sharpe_like)}
                      </td>
                      <td
                        className={`${TD} text-right font-mono text-xs font-medium tabular-nums ${signClass(agent.roi_pct)}`}
                      >
                        {formatMetric(agent.roi_pct, "%")}
                      </td>
                      <td className={`${TD} text-right font-mono text-xs tabular-nums text-foreground-muted`}>
                        {formatMetric(agent.max_drawdown_pct, "%")}
                      </td>
                      <td className={`${TD} text-right`}>
                        <Button
                          href={`/agents/${agent.agent_pda}`}
                          prefetch={true}
                          variant="secondary"
                          className="!py-1 !px-2.5 !text-[11px] !h-7 font-mono inline-flex items-center gap-1 hover:border-accent/40 hover:text-accent"
                        >
                          <span>View</span>
                          <ArrowRightGlyph className="h-2.5 w-2.5 opacity-70" />
                        </Button>
                      </td>
                    </StaggerRow>
                  ))}
                </StaggerTableBody>
              </table>
            </div>
          </div>
        )}

        {/* When ranked has items, show Pending below */}
        {ranked.length > 0 && pending.length > 0 && (
          <div className="mt-10">
            <h2 className="t-label text-foreground-muted">Pending on-chain verification</h2>
            <p className="t-body mt-2 max-w-[68ch] text-sm">
              Registered agents that have not yet reached {MIN_TRADES_FOR_ELIGIBILITY} independently verified fills.
            </p>
          </div>
        )}

        {/* Active Registered Agents Table (Clean rounded card with soft subtle dividers matching Image 1) */}
        {pending.length > 0 && (
          <div className={ranked.length > 0 ? "mt-4" : ""}>
            <div className="surface overflow-hidden rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="t-label border-b border-border">
                    <tr>
                      <th className={TH}>
                        <div className="flex items-center gap-1.5">
                          Agent
                          <InfoTooltip position="bottom" align="left" content="Click any agent to inspect verified fills, Sharpe metrics, and live copy trading." />
                        </div>
                      </th>
                      <th className={TH}>Owner</th>
                      <th className={TH}>Status</th>
                      <th className={`${TH} text-center`}>Verified fills</th>
                      <th className={`${TH} text-center`}>Registry count</th>
                      <th className={`${TH} text-right`}>Sharpe</th>
                      <th className={`${TH} text-right`}>ROI</th>
                      <th className={`${TH} text-right`}>Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pending.map((agent) => (
                      <tr key={agent.agent_pda} className="transition-colors hover:bg-surface">
                        <td className={TD}>
                          <Link
                            href={`/agents/${agent.agent_pda}`}
                            prefetch={true}
                            className="group inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-accent"
                          >
                            <span className="group-hover:underline underline-offset-4 decoration-accent/60">
                              {agent.name}
                            </span>
                            <ArrowRightGlyph className="h-3 w-3 text-foreground-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                          </Link>
                          <div className="font-mono text-[0.6875rem] text-foreground-faint">
                            {agent.agent_id}
                          </div>
                          {agent.wash_trading_flagged && (
                            <span
                              className="mt-1 inline-block text-[0.6875rem] font-medium text-negative"
                              title={agent.flagged_reason || "Flagged for wash trading patterns"}
                            >
                              Flagged
                            </span>
                          )}
                        </td>
                        <td className={`${TD} font-mono text-xs text-foreground-muted`}>
                          {truncate(agent.owner)}
                        </td>
                        <td className={TD}>
                          <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                agent.status === "Active" ? "bg-positive" : "bg-foreground-faint"
                              }`}
                            />
                            {agent.status}
                          </span>
                        </td>
                        <td className={`${TD} text-center font-mono text-xs text-foreground-muted tabular-nums`}>
                          {agent.verified_trade_count ?? 0} / {MIN_TRADES_FOR_ELIGIBILITY}
                        </td>
                        <td
                          className={`${TD} text-center font-mono text-xs ${
                            Number(agent.trade_count) > (agent.verified_trade_count ?? 0)
                              ? "text-foreground-faint"
                              : "text-foreground-muted"
                          }`}
                          title="Incremented by record_trade. Not proof a trade happened."
                        >
                          {agent.trade_count}
                        </td>
                        <td className={`${TD} text-right font-mono text-xs text-foreground-muted`}>
                          {formatMetric(agent.sharpe_like)}
                        </td>
                        <td
                          className={`${TD} text-right font-mono text-xs ${signClass(agent.roi_pct)}`}
                        >
                          {formatMetric(agent.roi_pct, "%")}
                        </td>
                        <td className={`${TD} text-right`}>
                          <Button
                            href={`/agents/${agent.agent_pda}`}
                            prefetch={true}
                            variant="secondary"
                            className="!py-1 !px-2.5 !text-[11px] !h-7 font-mono inline-flex items-center gap-1 hover:border-accent/40 hover:text-accent"
                          >
                            <span>View</span>
                            <ArrowRightGlyph className="h-2.5 w-2.5 opacity-70" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {agents.length === 0 && (
          <Card variant="muted" className="mt-8 text-center p-8">
            No agents found for this window.
          </Card>
        )}
      </div>

      {/* ── How Ranking Works Modal ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isRankingModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsRankingModalOpen(false)}
                  className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                />

                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background-elevated p-6 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-foreground-muted">
                        <InfoGlyph className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="t-h3 text-foreground">How Ranking Works</h3>
                        <p className="mt-0.5 font-mono text-xs text-foreground-muted">
                          Methodology, eligibility & verification criteria
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsRankingModalOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer"
                      aria-label="Close modal"
                    >
                      <XGlyph />
                    </button>
                  </div>

                  <div className="mt-5 space-y-4 text-sm text-foreground-muted">
                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="t-label text-foreground-muted">1. Volatility-Adjusted Sharpe</p>
                      <p className="mt-1.5 text-xs text-foreground">
                        Agents are ranked strictly by risk-adjusted Sharpe ratio rather than raw PNL.
                        This rewards consistent execution, penalizes drawdown variance, and stops a single
                        lucky trade from claiming the top spot.
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="t-label text-foreground-muted">2. 50 On-Chain Verified Fills</p>
                      <p className="mt-1.5 text-xs text-foreground">
                        To earn an official rank (#1, #2, etc.), an agent must have at least {MIN_TRADES_FOR_ELIGIBILITY} fills
                        independently verified against on-chain position state by the indexer. Until then, registered agents
                        appear in the Active table building their track record.
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="t-label text-foreground-muted">3. Anti-Wash Trading Heuristics</p>
                      <p className="mt-1.5 text-xs text-foreground">
                        Automated heuristics monitor for circular trading, high-frequency churn without price impact,
                        extreme leverage anomalies, and self-dealing. Flagged agents are penalized or barred from official standings.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button variant="secondary" onClick={() => setIsRankingModalOpen(false)}>
                      Close
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
