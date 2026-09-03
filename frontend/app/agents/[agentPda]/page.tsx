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

export const revalidate = 15;

/**
 * Mirrors REAL_TRADE_PREDICATE in pnl-indexer's store.ts. mockDriver writes a
 * `simulated_<timestamp>` signature; those rows are shown but never counted.
 */
function isSimulated(txSignature: string | null): boolean {
  return !txSignature || txSignature.startsWith("simulated_");
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

      <div className="w-full flex flex-col gap-8 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl">

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
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="t-h2 text-foreground">{data.agent.name}</h1>
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
              <div className="mt-1.5 font-mono text-xs text-foreground-faint">
                {data.agent.agent_id.trim()}
              </div>
              {data.agent.is_paper && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-500/80 font-mono">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Paper agent — live Binance prices, simulated capital. Performance is permanently excluded from leaderboard, reputation, Arena, and copy-trading.</span>
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


          <StaggerGrid className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              <StatTile label="Owner" value={truncate(data.agent.owner)} mono />
            </StaggerItem>
            <StaggerItem>
              <StatTile label="Vault" value={truncate(data.agent.vault_pubkey)} mono />
            </StaggerItem>
          </StaggerGrid>

          {/* ── Proof of Performance ─────────────────────────────────────── */}
          {(() => {
            const verifiedCount = data.trades.filter((t) => !isSimulated(t.tx_signature)).length;
            const simCount = data.trades.filter((t) => isSimulated(t.tx_signature)).length;
            const totalCount = data.trades.length;
            const isWash = data.antiGaming?.isWashTraded ?? false;
            const sharpe = data.pnlHistory[0]?.sharpe_like ? Number(data.pnlHistory[0].sharpe_like) : null;
            const roi = data.pnlHistory[0]?.roi_pct ? Number(data.pnlHistory[0].roi_pct) : null;
            const drawdown = data.pnlHistory[0]?.max_drawdown_pct ? Number(data.pnlHistory[0].max_drawdown_pct) : null;
            const isVerified = verifiedCount > 0 && !isWash;
            const isDeveloping = verifiedCount === 0 && !isWash;

            return (
              <div className="mb-8 overflow-hidden rounded-xl surface">
                {/* Header */}
                <div className={`flex items-center justify-between gap-3 px-5 py-3 ${
                  isWash ? "bg-negative/8" : isVerified ? "bg-positive/5" : "bg-surface"
                }`}>
                  <div className="flex items-center gap-2.5">
                    {isWash ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-negative">
                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    ) : isVerified ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-positive">
                        <path d="M8 1.25A6.75 6.75 0 1 0 14.75 8 6.757 6.757 0 0 0 8 1.25Zm3.03 5.47-3.5 3.5a.748.748 0 0 1-1.06 0l-1.5-1.5a.75.75 0 0 1 1.06-1.06l.97.97 2.97-2.97a.75.75 0 0 1 1.06 1.06Z" fill="currentColor"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-foreground-faint">
                        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
                        <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="8" cy="10.5" r="0.75" fill="currentColor"/>
                      </svg>
                    )}
                    <span className={`font-mono text-xs font-bold uppercase tracking-wider ${
                      isWash ? "text-negative" : isVerified ? "text-positive" : "text-foreground-muted"
                    }`}>
                      {isWash ? "ViperX Flagged" : isVerified ? "ViperX Verified" : "Developing Track Record"}
                    </span>
                    {isVerified && (
                      <span className="rounded-full bg-positive/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-positive">
                        {verifiedCount} on-chain trade{verifiedCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-foreground-faint">
                    Verified by independent on-chain execution
                  </span>
                </div>

                {/* Body */}
                <div className="grid divide-x divide-border sm:grid-cols-4">
                  {/* Trade authenticity */}
                  <div className="flex flex-col gap-1 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">Authenticity</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-positive transition-all"
                          style={{ width: totalCount ? `${(verifiedCount / totalCount) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {totalCount ? Math.round((verifiedCount / totalCount) * 100) : 0}%
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-foreground-faint">
                      {verifiedCount} verified · {simCount} simulated
                    </p>
                  </div>

                  {/* Sharpe */}
                  <div className="flex flex-col gap-1 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">Risk-Adjusted Score</p>
                    <p className={`mt-1 font-mono text-xl font-bold ${
                      sharpe === null ? "text-foreground-faint" : sharpe >= 1 ? "text-positive" : sharpe >= 0 ? "text-foreground" : "text-negative"
                    }`}>
                      {sharpe !== null ? sharpe.toFixed(2) : "—"}
                    </p>
                    <p className="text-[10px] text-foreground-faint">Sharpe-like ratio</p>
                  </div>

                  {/* ROI */}
                  <div className="flex flex-col gap-1 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">Realized ROI</p>
                    <p className={`mt-1 font-mono text-xl font-bold ${
                      roi === null ? "text-foreground-faint" : roi >= 0 ? "text-positive" : "text-negative"
                    }`}>
                      {roi !== null ? `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%` : "—"}
                    </p>
                    <p className="text-[10px] text-foreground-faint">Based on closed positions</p>
                  </div>

                  {/* Max drawdown */}
                  <div className="flex flex-col gap-1 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">Max Drawdown</p>
                    <p className={`mt-1 font-mono text-xl font-bold ${
                      drawdown === null ? "text-foreground-faint" : drawdown > 20 ? "text-negative" : drawdown > 10 ? "text-foreground" : "text-positive"
                    }`}>
                      {drawdown !== null ? `-${Math.abs(drawdown).toFixed(2)}%` : "—"}
                    </p>
                    <p className="text-[10px] text-foreground-faint">Peak-to-trough equity</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-border px-5 py-2.5 flex items-center justify-between">
                  <p className="text-[10px] text-foreground-faint">
                    {isWash
                      ? `Flagged: ${data.antiGaming?.flaggedReason ?? "repeated pattern violation"}`
                      : isDeveloping
                      ? "No on-chain trades yet. Start the agent to build a verified track record."
                      : `${verifiedCount} trades independently verified via on-chain transaction signatures.`}
                  </p>
                  <a
                    href={explorerAddress(data.agent).startsWith("0x")
                      ? `https://sepolia.basescan.org/address/${explorerAddress(data.agent)}`
                      : `https://explorer.solana.com/address/${data.agent.agent_pda}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-accent hover:underline inline-flex items-center gap-1"
                  >
                    <span>Verify on-chain</span>
                    <ExternalLinkGlyph className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })()}

          {data.pnlHistory && <InteractiveChart snapshots={data.pnlHistory} />}

          {data.agent.strategy_uri && (
            <Card className="mb-8">
              <span className="font-medium text-foreground">Strategy URI: </span>
              <span className="break-all text-foreground-muted">{data.agent.strategy_uri}</span>
            </Card>
          )}

          {/* ── Trade History ── */}
          {data.agent.is_paper ? (
            <>
              <div className="flex items-center gap-2 mb-3 mt-10">
                <h2 className="t-h3 text-foreground">Trade History</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  PAPER TRACK
                </span>
              </div>
              <p className="t-body mb-3 text-xs text-foreground-faint">
                These trades used live Binance prices and simulated capital. They are permanently preserved but will never enter verified PnL, leaderboard, or reputation.
              </p>
              <TradesTable trades={data.trades} />
            </>
          ) : (
            <>
              {/* Devnet / Live track */}
              {data.trades.some((t) => t.is_paper) && (
                <div className="flex items-center gap-2 mb-1 mt-10">
                  <h2 className="t-h3 text-foreground">Trade History</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    DEVNET TRACK
                  </span>
                </div>
              )}
              {!data.trades.some((t) => t.is_paper) && (
                <h2 className="t-h3 mb-3 text-foreground">Trade History</h2>
              )}
              {data.trades.some((t) => isSimulated(t.tx_signature)) && (
                <p className="t-body mb-3 text-xs text-foreground-faint">
                  Rows marked <span className="font-mono">SIM</span> were written by a mock run and
                  never settled on-chain. They are listed for transparency but excluded from ROI,
                  Sharpe, drawdown and leaderboard ranking.
                </p>
              )}
              <TradesTable trades={data.trades.filter((t) => !t.is_paper)} />

              {/* Paper track history (preserved after transition) */}
              {data.trades.some((t) => t.is_paper) && (
                <>
                  <div className="flex items-center gap-2 mb-3 mt-10">
                    <h2 className="t-h3 text-foreground">Historical Paper Track</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      PAPER — READ ONLY
                    </span>
                  </div>
                  <p className="t-body mb-3 text-xs text-foreground-faint">
                    Preserved paper trading history from before this agent transitioned to Devnet. These trades use simulated capital and are excluded from all live metrics.
                  </p>
                  <TradesTable trades={data.trades.filter((t) => t.is_paper)} />
                </>
              )}
            </>
          )}

          <h2 className="t-h3 mb-3 mt-10 text-foreground">PNL Snapshots History</h2>
          <SnapshotsTable snapshots={data.pnlHistory} />

          {!data.agent.is_paper && (
            <CopyTradingPanel
              agentPda={data.agent.agent_pda}
              ownerAddress={data.agent.owner}
              copying={data.copying}
              followers={data.followers}
            />
          )}

          <h2 className="t-h3 mb-3 mt-10 text-foreground">Skills</h2>
          <SkillsPanel skills={data.skills} />

          <div className="mb-3 mt-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="t-h3 text-foreground">Tuning Log</h2>
              <p className="t-body mt-1 text-xs text-foreground-faint">
                Automatic adjustments and owner fine-tuning of this agent&apos;s strategy thresholds.
              </p>
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

          {data.agent.is_paper && (
            <TransitionToDevnetPanelLazy agentPda={agentPda} chain={data.agent.chain ?? "solana"} />
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
    <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Object.entries(SKILL_LABELS).map(([key, label]) => {
        const unlocked = unlockedByKey.get(key);
        const isUnlocked = Boolean(unlocked);

        return (
          <StaggerItem key={key} className="h-full">
            <div
              className={`surface flex h-full flex-col justify-between rounded-xl p-5 transition-all ${
                isUnlocked
                  ? "hover:border-border-strong hover:shadow-xs"
                  : "opacity-60 bg-background-muted/40"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        isUnlocked
                          ? "border-border bg-surface text-foreground shadow-2xs"
                          : "border-border bg-surface text-foreground-faint"
                      }`}
                    >
                      <SkillIcon skillKey={key} unlocked={isUnlocked} />
                    </div>
                    <h4 className="font-semibold text-foreground text-sm leading-tight">
                      {label.name}
                    </h4>
                  </div>

                  {isUnlocked ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-foreground-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                      Unlocked
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-foreground-faint">
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground-faint" />
                      Locked
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
                  {label.description}
                </p>
              </div>

              {unlocked ? (
                <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-3 font-mono text-xs text-foreground-faint">
                  <span>Unlocked {formatSkillDate(unlocked.unlocked_at)}</span>
                  <span className="text-foreground-muted font-medium">
                    {unlocked.source_trade_count} verified fills
                  </span>
                </div>
              ) : (
                <div className="mt-5 border-t border-border/30 pt-3 font-mono text-xs text-foreground-faint">
                  Requirement not met yet
                </div>
              )}
            </div>
          </StaggerItem>
        );
      })}
    </StaggerGrid>
  );
}


