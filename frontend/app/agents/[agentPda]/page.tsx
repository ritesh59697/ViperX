import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AgentNotFoundError,
  fetchAgent,
  PnlSnapshotRecord,
  SkillRecord,
  TradeRecord,
  TuningHistoryEntry,
} from "@/lib/leaderboardApi";
import { SKILL_LABELS } from "@/lib/skills";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { StaggerGrid, StaggerItem } from "@/components/motion/StaggerGrid";
import { StaggerTableBody, StaggerRow } from "@/components/motion/StaggerTable";
import { InteractiveChart } from "@/components/agent/InteractiveChart";
import { CopyTradeModal } from "@/components/agent/CopyTradeModal";
import { CopyTradingPanel } from "@/components/agent/CopyTradingPanel";
import { TuneStrategyModal } from "@/components/agent/TuneStrategyModal";
import { CheckGlyph, ExternalLinkGlyph } from "@/components/ui/StatusGlyphs";
import { TradesTable, SnapshotsTable, TuningLogTable } from "@/components/agent/HistoryTables";
import { TransitionToDevnetPanelLazy } from "@/components/agent/TransitionToDevnetPanelLazy";
import { AgentLiveTelemetry } from "@/components/agent/AgentLiveTelemetry";
import { AgentActivationGuide } from "@/components/agent/AgentActivationGuide";
import { AgentNavSync } from "@/components/agent/AgentNavSync";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export const revalidate = 15;

/**
 * Mirrors REAL_TRADE_PREDICATE in pnl-indexer's store.ts. mockDriver writes a
 * `simulated_<timestamp>` signature; those rows are shown but never counted.
 */
function isSimulated(txSignature: string | null): boolean {
  if (!txSignature) return true;
  return (
    txSignature.startsWith("simulated_") ||
    txSignature.startsWith("evm_sim_") ||
    txSignature.startsWith("paper_") ||
    txSignature.includes("_sim_") ||
    txSignature.includes("mock")
  );
}

function truncate(address: string): string {
  return `${address.slice(0, 4)}..${address.slice(-4)}`;
}

function explorerAddress(agent: { agent_pda: string; vault_pubkey: string; owner: string }): string {
  if (agent.vault_pubkey?.startsWith("0x")) return agent.vault_pubkey;
  if (agent.owner?.startsWith("0x")) return agent.owner;
  return agent.agent_pda;
}

function formatMetric(value: string | null, suffix = ""): string {
  if (value === null) return "N/A";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}${suffix}` : "N/A";
}

function formatDate(value: string | null): string {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ agentPda: string }>;
}) {
  const { agentPda } = await params;

  let data: (Awaited<ReturnType<typeof fetchAgent>> & { antiGaming?: { isWashTraded: boolean; flaggedReason: string | null; validTradeCount: number } }) | null = null;
  let fetchError: string | null = null;
  let isIndexing = false;
  try {
    data = await fetchAgent(agentPda);
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      isIndexing = true;
    } else {
      fetchError = err instanceof Error ? err.message : "Failed to reach leaderboard-api.";
    }
  }

  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <div className="mb-4">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-foreground-muted transition-colors hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to leaderboard
        </Link>
      </div>

      <div className="w-full flex flex-col gap-10 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl">

      {fetchError && (
        <div className="mx-auto max-w-md py-14 text-center font-mono">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-accent">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>
          <h2 className="text-base font-bold text-foreground">Agent Profile Temporarily Unavailable</h2>
          <p className="mt-2 text-xs leading-relaxed text-foreground-muted font-sans max-w-sm mx-auto">
            The verification indexer is currently synchronizing or experiencing high traffic. Please try reconnecting in a few moments.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href={`/agents/${agentPda}`}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-5 text-xs font-semibold text-accent-foreground hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              Retry Connection
            </a>
            <Link
              href="/leaderboard"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors"
            >
              Back to Leaderboard
            </Link>
          </div>
        </div>
      )}

      {isIndexing && (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-accent/20 opacity-75" />
              <div className="relative h-12 w-12 rounded-full border border-accent bg-accent/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-accent">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
              </div>
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground">Agent Indexing in Progress</h2>
          <p className="t-body-sm mt-3 text-foreground-muted">
            Your agent has been registered successfully on-chain! The indexer is currently scanning the block to register your agent details.
          </p>
          <p className="font-mono text-[10px] text-foreground-faint mt-3 break-all">
            PDA / {agentPda}
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <a
              href={`/agents/${agentPda}`}
              className="inline-flex h-9 items-center justify-center rounded-full bg-accent text-accent-foreground px-5 text-xs font-semibold shadow-lg shadow-accent/20 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            >
              Check Status
            </a>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-surface px-5 text-xs font-semibold text-foreground hover:bg-surface-hover cursor-pointer transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}

      {data && (
        <>
          <AgentNavSync agent={data.agent} />

          {/* ── Dashboard-style Profile Header ── */}
          <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-bold font-mono text-foreground tracking-tight">{data.agent.name}</h1>
                {data.agent.is_paper ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[0.6875rem] font-bold text-amber-500 uppercase tracking-wide">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Paper Trading
                  </span>
                ) : data.antiGaming?.isWashTraded ? (
                  <span className="rounded-full border border-negative/25 bg-negative/5 px-2.5 py-0.5 text-[0.6875rem] font-medium text-negative">
                    Flagged — wash trading
                  </span>
                ) : (
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-[0.6875rem] font-medium text-foreground-muted">
                    Verified
                  </span>
                )}
              </div>
              <div className="mt-2 font-mono text-xs text-foreground-faint">
                {data.agent.agent_id.trim()}
              </div>
              {data.agent.is_paper && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-500/80 font-mono max-w-2xl">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Paper agent — live Binance prices, simulated capital. Excluded from leaderboard and copy-trading.</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <TuneStrategyModal
                agentPda={data.agent.agent_pda}
                ownerAddress={data.agent.owner}
                agentName={data.agent.name}
                agentId={data.agent.agent_id}
                strategyUri={data.agent.strategy_uri}
              />
              {!data.agent.is_paper && (
                <CopyTradeModal
                  sourceAgentPda={data.agent.agent_pda}
                  agentName={data.agent.name}
                  agentId={data.agent.agent_id}
                />
              )}
              <Button
                variant="outline"
                href={explorerAddress(data.agent).startsWith("0x")
                  ? `https://sepolia.basescan.org/address/${explorerAddress(data.agent)}`
                  : `https://explorer.solana.com/address/${data.agent.agent_pda}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {data.agent.is_paper ? (
                  "Paper Agent (no explorer)"
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span>Explorer</span>
                    <ExternalLinkGlyph className="h-3 w-3" />
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* ── Agent Overview (Stats, Telemetry, Proof of Performance) ── */}
          <div id="agent-overview" className="scroll-mt-24 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-semibold text-foreground">Agent Overview</h2>
                <InfoTooltip content="Live metrics, performance stats, and on-chain verification status." />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground-muted font-semibold">
                {data.agent.chain === "base" || data.agent.owner.startsWith("0x") ? "Base Sepolia" : "Solana Devnet"}
              </span>
            </div>

            <StaggerGrid className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StaggerItem>
                <StatTile label="Status" value={data.agent.status} />
              </StaggerItem>
              <StaggerItem>
                <StatTile
                  label="Trades"
                  value={data.agent.trade_count}
                  animate={{ value: Number(data.agent.trade_count), decimals: 0 }}
                />
              </StaggerItem>
              <StaggerItem>
                <StatTile
                  label="Leaderboard eligible"
                  value={data.agent.leaderboard_eligible ? "Yes" : "No"}
                />
              </StaggerItem>
              <StaggerItem>
                <StatTile
                  label="Sharpe-like"
                  value={formatMetric(data.pnlHistory[0]?.sharpe_like ?? null)}
                  animate={
                    data.pnlHistory[0]?.sharpe_like != null
                      ? { value: Number(data.pnlHistory[0].sharpe_like), decimals: 2 }
                      : undefined
                  }
                />
              </StaggerItem>
              <StaggerItem>
                <StatTile
                  label="ROI"
                  value={formatMetric(data.pnlHistory[0]?.roi_pct ?? null, "%")}
                  animate={
                    data.pnlHistory[0]?.roi_pct != null
                      ? { value: Number(data.pnlHistory[0].roi_pct), decimals: 2, suffix: "%" }
                      : undefined
                  }
                />
              </StaggerItem>
              <StaggerItem>
                <StatTile
                  label="Max drawdown"
                  value={formatMetric(data.pnlHistory[0]?.max_drawdown_pct ?? null, "%")}
                  animate={
                    data.pnlHistory[0]?.max_drawdown_pct != null
                      ? { value: Number(data.pnlHistory[0].max_drawdown_pct), decimals: 2, suffix: "%" }
                      : undefined
                  }
                />
              </StaggerItem>
              <StaggerItem>
                <StatTile label="Owner" value={truncate(data.agent.owner)} fullValue={data.agent.owner} mono />
              </StaggerItem>
              <StaggerItem>
                <StatTile label="Vault" value={truncate(data.agent.vault_pubkey)} fullValue={data.agent.vault_pubkey} mono />
              </StaggerItem>
            </StaggerGrid>

            {/* ── Live Strategy Telemetry & Autonomous Thought Stream ───────── */}
            <AgentLiveTelemetry agent={data.agent} />

            {/* ── Proof of Performance ─────────────────────────────────────── */}
            {(() => {
              const verifiedCount = data.trades.filter((t) => !isSimulated(t.tx_signature)).length;
              const simCount = data.trades.filter((t) => isSimulated(t.tx_signature)).length;
              const totalCount = data.trades.length;
              const isWash = data.antiGaming?.isWashTraded ?? false;
              const isVerified = verifiedCount > 0 && !isWash;
              const isDeveloping = verifiedCount === 0 && !isWash;

              return (
                <>
                  {/* ── Compact On-Chain Verification Ribbon ───────────────── */}
                  <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 px-5 py-3 surface ${
                    isWash ? "border-negative/30 bg-negative/5" : isVerified ? "border-positive/20 bg-positive/[0.03]" : ""
                  }`}>
                    {/* Left: Badge & Authenticity */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        {isWash ? (
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-negative shrink-0">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        ) : isVerified ? (
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-positive shrink-0">
                            <path d="M8 1.25A6.75 6.75 0 1 0 14.75 8 6.757 6.757 0 0 0 8 1.25Zm3.03 5.47-3.5 3.5a.748.748 0 0 1-1.06 0l-1.5-1.5a.75.75 0 0 1 1.06-1.06l.97.97 2.97-2.97a.75.75 0 0 1 1.06 1.06Z" fill="currentColor"/>
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-foreground-faint shrink-0">
                            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
                            <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <circle cx="8" cy="10.5" r="0.75" fill="currentColor"/>
                          </svg>
                        )}
                        <span className={`font-mono text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
                          isWash ? "text-negative" : isVerified ? "text-positive" : "text-foreground-muted"
                        }`}>
                          {isWash ? "ViperX Flagged" : isVerified ? "ViperX Verified" : "Developing Track Record"}
                        </span>
                      </div>

                      <span className="hidden sm:inline text-foreground-faint text-xs">·</span>

                      {/* Authenticity gauge */}
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-foreground-muted text-[11px]">Authenticity:</span>
                        <div className="h-1.5 w-16 sm:w-24 overflow-hidden rounded-full bg-surface border border-border">
                          <div
                            className="h-full rounded-full bg-positive transition-all"
                            style={{ width: totalCount ? `${(verifiedCount / totalCount) * 100}%` : "0%" }}
                          />
                        </div>
                        <span className="font-semibold text-foreground tabular-nums text-[11px]">
                          {totalCount ? Math.round((verifiedCount / totalCount) * 100) : 0}%
                        </span>
                        <span className="text-[10px] text-foreground-faint hidden md:inline">
                          ({verifiedCount} on-chain{simCount > 0 ? ` · ${simCount} simulated` : ""})
                        </span>
                      </div>
                    </div>

                    {/* Right: Explorer Proof Link */}
                    <div className="flex items-center gap-3">
                      {isWash && (
                        <span className="hidden lg:inline text-[11px] text-negative font-mono">
                          Flagged: {data.antiGaming?.flaggedReason ?? "pattern violation"}
                        </span>
                      )}
                      <a
                        href={explorerAddress(data.agent).startsWith("0x")
                          ? `https://sepolia.basescan.org/address/${explorerAddress(data.agent)}`
                          : `https://explorer.solana.com/address/${data.agent.agent_pda}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-accent hover:underline inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
                      >
                        <span>Verify on-chain</span>
                        <ExternalLinkGlyph className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    </div>
                  </div>

                  {isDeveloping && (
                    <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg bg-white p-5 dark:bg-[#0a0a0a]">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-foreground-muted">
                              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 shrink-0" />
                              STANDBY
                            </span>
                            <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                              Autonomous Trading Engine
                            </span>
                          </div>
                          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-muted">
                            Active on {data.agent.chain === "base" || data.agent.owner.startsWith("0x") ? "Base Sepolia" : "Solana Devnet"}. The runtime scans oracle prices every 15s and fires orders once volatility crosses strategy thresholds.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            href="#agent-tuning"
                            className="text-xs"
                          >
                            Tune Parameters
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* ── Interactive Chart ── */}
          <div id="agent-chart" className="scroll-mt-24 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-semibold text-foreground">Performance Chart</h2>
                <InfoTooltip content="Historical profit and loss (PnL) mapped against strategy parameters." />
              </div>
            </div>

            {data.pnlHistory && <InteractiveChart snapshots={data.pnlHistory} />}
          </div>

          {/* ── Day 1 Readiness & Strategy Test-Fire Guide (shown when 0 trades) ── */}
          {data.trades.length === 0 && (
            <div id="agent-activation" className="scroll-mt-24 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-sm font-semibold text-foreground">Strategy Activation & Test-Fire</h2>
                  <InfoTooltip content="Instructions to fund the agent and trigger the first live trade." />
                </div>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-500 uppercase">
                  Awaiting Initial Fill
                </span>
              </div>
              <AgentActivationGuide agent={data.agent} />
            </div>
          )}

          {/* ── Trade History ── */}
          <div id="agent-history" className="scroll-mt-24 space-y-4">
            {data.agent.is_paper ? (
              <>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono text-sm font-semibold text-foreground">Trade History</h2>
                    <InfoTooltip content="Log of executed trades. Simulated fills do not impact metrics." />
                    <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                      PAPER TRACK
                    </span>
                  </div>
                  <span className="font-mono text-xs text-foreground-muted">
                    {data.trades.length} recorded fills
                  </span>
                </div>
                <p className="font-mono text-xs text-foreground-muted">
                  Simulated fills with live Binance prices. Excluded from verified PnL, leaderboard, and reputation.
                </p>
                <TradesTable trades={data.trades} />
              </>
            ) : (
              <>
                {/* Devnet / Live track */}
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono text-sm font-semibold text-foreground">Trade History</h2>
                    <InfoTooltip content="Log of executed trades. Simulated fills do not impact metrics." />
                    {data.trades.some((t) => t.is_paper) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                        DEVNET TRACK
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-foreground-muted">
                    {data.trades.filter((t) => !t.is_paper).length} recorded fills
                  </span>
                </div>
                {data.trades.some((t) => isSimulated(t.tx_signature)) && (
                  <p className="font-mono text-xs text-foreground-muted">
                    Rows marked <span className="font-mono font-bold text-foreground">SIM</span> are simulated test runs excluded from leaderboard metrics.
                  </p>
                )}
                <TradesTable trades={data.trades.filter((t) => !t.is_paper)} />

                {/* Paper track history (preserved after transition) */}
                {data.trades.some((t) => t.is_paper) && (
                  <div className="space-y-4 pt-6">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <h2 className="font-mono text-sm font-semibold text-foreground">Historical Paper Track</h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                          PAPER — READ ONLY
                        </span>
                      </div>
                      <span className="font-mono text-xs text-foreground-muted">
                        {data.trades.filter((t) => t.is_paper).length} fills
                      </span>
                    </div>
                    <TradesTable trades={data.trades.filter((t) => t.is_paper)} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── PNL Snapshots History ── */}
          <div id="agent-snapshots" className="scroll-mt-24 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-semibold text-foreground">PNL Snapshots History</h2>
                <InfoTooltip content="Periodic records of the agent's equity and performance." />
              </div>
              <span className="font-mono text-xs text-foreground-muted">
                {data.pnlHistory.length} snapshots
              </span>
            </div>
            <SnapshotsTable snapshots={data.pnlHistory} />
          </div>

          {/* ── Copy Trading ── */}
          {!data.agent.is_paper && (
            <div id="agent-copy" className="scroll-mt-24 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-sm font-semibold text-foreground">Copy-Trading & Social</h2>
                  <InfoTooltip content="Manage followers and autonomous execution for copy-trading." />
                </div>
              </div>
              <CopyTradingPanel
                agentPda={data.agent.agent_pda}
                ownerAddress={data.agent.owner}
                copying={data.copying}
                followers={data.followers}
              />
            </div>
          )}

          {/* ── Skills Panel ── */}
          <div id="agent-skills" className="scroll-mt-24 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-semibold text-foreground">Skills & Proofs</h2>
                <InfoTooltip content="On-chain verifiable achievements unlocked by the agent." />
              </div>
              <span className="font-mono text-xs text-foreground-muted">
                {data.skills.length} unlocked
              </span>
            </div>
            <SkillsPanel skills={data.skills} />
          </div>

          {/* ── Tuning Log ── */}
          <div id="agent-tuning" className="scroll-mt-24 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-semibold text-foreground">Tuning Log</h2>
                <InfoTooltip content="History of parameter updates and strategy adjustments." />
              </div>
              <TuneStrategyModal
                agentPda={data.agent.agent_pda}
                ownerAddress={data.agent.owner}
                agentName={data.agent.name}
                agentId={data.agent.agent_id}
                strategyUri={data.agent.strategy_uri}
                buttonVariant="outline"
              />
            </div>
            <TuningLogTable entries={data.tuningHistory} />
          </div>

          {/* ── Devnet Transition Panel ── */}
          {data.agent.is_paper && (
            <div id="agent-devnet" className="scroll-mt-24 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-sm font-semibold text-foreground">Transition to Devnet</h2>
                  <InfoTooltip content="Migrate your paper agent to an active live devnet." />
                </div>
              </div>
              <TransitionToDevnetPanelLazy agentPda={agentPda} chain={data.agent.chain ?? "solana"} />
            </div>
          )}
        </>
      )}
      </div>
    </Section>
  );
}



function SkillIcon({ skillKey, unlocked }: { skillKey: string; unlocked: boolean }) {
  const iconSrc = `/skills/${skillKey}.png`;
  const bgClass = unlocked ? "bg-foreground" : "bg-foreground-faint";

  return (
    <div
      className={`h-5 w-5 ${bgClass} transition-colors`}
      style={{
        maskImage: `url(${iconSrc})`,
        WebkitMaskImage: `url(${iconSrc})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

function formatSkillDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function SkillsPanel({ skills }: { skills: SkillRecord[] }) {
  const unlockedByKey = new Map(skills.map((s) => [s.skill_key, s]));

  return (
    <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-stretch">
      {Object.entries(SKILL_LABELS).map(([key, label]) => {
        const unlocked = unlockedByKey.get(key);
        const isUnlocked = Boolean(unlocked);

        return (
          <StaggerItem key={key} className="flex h-full flex-col">
            <div
              className={`flex h-full flex-col rounded-xl border p-1 transition-all duration-200 ${
                isUnlocked
                  ? "border-black/10 bg-neutral-200/60 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]"
                  : "border-black/5 bg-neutral-100 opacity-60 dark:border-[#1a1a1a] dark:bg-[#0d0d0d]"
              }`}
            >
              <div className="flex h-full flex-1 flex-col justify-between rounded-lg bg-white p-5 dark:bg-[#0a0a0a]">
                <div>
                  <div className="flex min-h-[2.5rem] items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                          isUnlocked
                            ? "border-black/10 bg-neutral-100 text-foreground shadow-2xs dark:border-white/10 dark:bg-[#161616]"
                            : "border-black/5 bg-neutral-50 text-foreground-faint dark:border-white/5 dark:bg-[#111111]"
                        }`}
                      >
                        <SkillIcon skillKey={key} unlocked={isUnlocked} />
                      </div>
                      <h4 className="font-semibold text-foreground text-sm leading-tight">
                        {label.name}
                      </h4>
                    </div>

                    {isUnlocked ? (
                      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-foreground-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                        Unlocked
                      </span>
                    ) : (
                      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-foreground-faint">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground-faint" />
                        Locked
                      </span>
                    )}
                  </div>

                  <p className="mt-3 min-h-[2.5rem] text-xs leading-relaxed text-foreground-muted">
                    {label.description}
                  </p>
                </div>

                {unlocked ? (
                  <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3 font-mono text-xs text-foreground-faint dark:border-white/5">
                    <span>Unlocked {formatSkillDate(unlocked.unlocked_at)}</span>
                    <span className="font-medium text-foreground-muted">
                      {unlocked.source_trade_count} verified fills
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 border-t border-black/5 pt-3 font-mono text-xs text-foreground-faint dark:border-white/5">
                    Requirement not met yet
                  </div>
                )}
              </div>
            </div>
          </StaggerItem>
        );
      })}
    </StaggerGrid>
  );
}


