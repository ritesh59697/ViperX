"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { StaggerTableBody, StaggerRow } from "@/components/motion/StaggerTable";
import { ExternalLinkGlyph, ArrowCircleRightGlyph } from "@/components/ui/StatusGlyphs";
import type { TradeRecord, TuningHistoryEntry, PnlSnapshotRecord } from "@/lib/leaderboardApi";

function isSimulated(txSignature: string | null): boolean {
  return !txSignature || txSignature.startsWith("simulated_");
}

function explorerUrl(txSignature: string): string {
  return txSignature.startsWith("0x")
    ? `https://sepolia.basescan.org/tx/${txSignature}`
    : `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`;
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

export function TradesTable({ trades }: { trades: TradeRecord[] }) {
  const [visibleCount, setVisibleCount] = useState(10);

  if (trades.length === 0) {
    return <Card variant="muted">No recorded trades yet.</Card>;
  }

  const visibleTrades = trades.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile Card List (< md) */}
      <div className="flex flex-col gap-3 md:hidden">
        {visibleTrades.map((trade) => {
          const pnl = Number(trade.realized_pnl ?? 0);
          const isProfitable = pnl > 0;
          const isZero = pnl === 0;

          return (
            <div
              key={trade.tx_signature ?? `${trade.market_symbol}-${trade.opened_at}`}
              className="rounded-xl border border-border bg-surface/50 p-4 font-mono text-xs flex flex-col gap-3"
            >
              {/* Top row: Market + Side badge + Realized PnL */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground text-sm">{trade.market_symbol}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    trade.side === "long"
                      ? "bg-positive/10 text-positive border border-positive/20"
                      : "bg-negative/10 text-negative border border-negative/20"
                  }`}>
                    {trade.side}
                  </span>
                  {isSimulated(trade.tx_signature) && (
                    <span className="rounded border border-border bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-foreground-faint">
                      Sim
                    </span>
                  )}
                </div>
                <div className={`font-bold text-sm ${isProfitable ? "text-positive" : isZero ? "text-foreground-muted" : "text-negative"}`}>
                  {isProfitable ? "+" : ""}{formatMetric(trade.realized_pnl)}
                </div>
              </div>

              {/* Middle row: 2x2 grid for metrics */}
              <div className="grid grid-cols-2 gap-2 text-[11px] border-y border-border/40 py-2.5">
                <div>
                  <span className="text-foreground-faint block text-[10px] uppercase">Entry → Exit</span>
                  <span className="text-foreground font-semibold">
                    {formatMetric(trade.entry_price)} → {formatMetric(trade.exit_price)}
                  </span>
                </div>
                <div>
                  <span className="text-foreground-faint block text-[10px] uppercase">Size (USD)</span>
                  <span className="text-foreground font-semibold">${Number(trade.size_usd).toFixed(0)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-foreground-faint block text-[10px] uppercase">Opened</span>
                  <span className="text-foreground-muted">{formatDate(trade.opened_at)}</span>
                </div>
              </div>

              {/* Bottom row: Signal Rationale */}
              {trade.reason && (
                <div className="text-[11px] text-foreground-muted font-sans leading-relaxed bg-surface/30 p-2.5 rounded-lg border border-border/40 flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-foreground-faint font-bold">
                    Signal Rationale
                  </span>
                  <p className="line-clamp-3 text-xs leading-relaxed hover:line-clamp-none transition-all">
                    {trade.reason}
                  </p>
                  {trade.tx_signature && !isSimulated(trade.tx_signature) && (
                    <a
                      href={explorerUrl(trade.tx_signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-accent hover:underline self-end inline-flex items-center gap-1 mt-0.5"
                    >
                      <span>View on-chain</span>
                      <ExternalLinkGlyph className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-surface/40">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-border bg-surface/70 text-foreground-muted uppercase tracking-wider text-[10px] font-mono">
            <tr>
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Size (USD)</th>
              <th className="px-4 py-3 font-medium">Entry</th>
              <th className="px-4 py-3 font-medium">Exit</th>
              <th className="px-4 py-3 font-medium">Realized PNL</th>
              <th className="px-4 py-3 font-medium">Opened</th>
              <th className="px-4 py-3 font-medium">Rationale</th>
            </tr>
          </thead>
          <StaggerTableBody className="font-mono text-xs">
            {visibleTrades.map((trade) => (
              <StaggerRow
                key={trade.tx_signature ?? `${trade.market_symbol}-${trade.opened_at}`}
                className="border-t border-border/50 text-foreground transition-colors hover:bg-surface/60"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {trade.market_symbol}
                  {isSimulated(trade.tx_signature) && (
                    <span
                      className="ml-2 rounded border border-border px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wider text-foreground-faint"
                      title="Written by mockDriver, never settled on-chain. Excluded from ROI, Sharpe and drawdown."
                    >
                      Sim
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 capitalize">{trade.side}</td>
                <td className="px-4 py-3">${Number(trade.size_usd).toFixed(0)}</td>
                <td className="px-4 py-3">{formatMetric(trade.entry_price)}</td>
                <td className="px-4 py-3">{formatMetric(trade.exit_price)}</td>
                <td className="px-4 py-3 font-semibold">{formatMetric(trade.realized_pnl)}</td>
                <td className="px-4 py-3 text-foreground-muted whitespace-nowrap">{formatDate(trade.opened_at)}</td>
                <td className="px-4 py-3 font-sans text-xs text-foreground-muted max-w-[240px] truncate whitespace-normal" title={trade.reason || "N/A"}>
                  {trade.reason || "N/A"}
                  {trade.tx_signature && !isSimulated(trade.tx_signature) && (
                    <>
                      {" "}
                      <a
                        href={explorerUrl(trade.tx_signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline decoration-border underline-offset-2 whitespace-nowrap inline-flex items-center gap-1"
                      >
                        <span>tx</span>
                        <ExternalLinkGlyph className="h-2.5 w-2.5 opacity-70" />
                      </a>
                    </>
                  )}
                </td>
              </StaggerRow>
            ))}
          </StaggerTableBody>
        </table>
      </div>

      {trades.length > visibleCount && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 10)}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-surface-hover hover:border-foreground-muted cursor-pointer font-mono"
          >
            Show More ({trades.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

export function TuningLogTable({ entries }: { entries: TuningHistoryEntry[] }) {
  const [visibleCount, setVisibleCount] = useState(10);

  if (entries.length === 0) {
    return <Card variant="muted">No automatic tuning yet — the agent hasn&apos;t hit a rough enough patch to adjust.</Card>;
  }

  const visibleEntries = entries.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile Card List (< md) */}
      <div className="flex flex-col gap-3 md:hidden">
        {visibleEntries.map((entry) => (
          <div
            key={`${entry.param}-${entry.changed_at}`}
            className="rounded-xl border border-border bg-surface/50 p-4 font-mono text-xs flex flex-col gap-3"
          >
            {/* Top: Param Badge + Date */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground text-xs px-2.5 py-1 rounded-md bg-surface border border-border">
                {entry.param}
              </span>
              <span className="text-[10px] text-foreground-muted">
                {formatDate(entry.changed_at)}
              </span>
            </div>

            {/* Value Transition: Old -> Circle Arrow -> New */}
            <div className="flex items-center justify-between bg-surface/40 px-3.5 py-2.5 rounded-lg border border-border/40">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-foreground-faint">Previous</span>
                <span className="text-foreground-muted font-medium text-xs">{formatMetric(entry.old_value)}</span>
              </div>

              <div className="flex items-center justify-center text-accent">
                <ArrowCircleRightGlyph className="h-4 w-4" />
              </div>

              <div className="flex flex-col text-right">
                <span className="text-[9px] uppercase tracking-wider text-foreground-faint">Adjusted</span>
                <span className="text-foreground font-bold text-xs">{formatMetric(entry.new_value)}</span>
              </div>
            </div>

            {/* Reason */}
            {entry.reason && (
              <div className="text-[11px] text-foreground-muted font-sans leading-relaxed bg-surface/30 p-2.5 rounded-lg border border-border/30">
                <span className="font-mono text-[9px] uppercase tracking-wider text-foreground-faint font-semibold block mb-0.5">
                  Adjustment Reason
                </span>
                <p>{entry.reason}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-surface/40">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border bg-surface/70 text-foreground-muted uppercase tracking-wider text-[10px] font-mono">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Param</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3 font-medium">Reason</th>
            </tr>
          </thead>
          <StaggerTableBody className="font-mono text-xs">
            {visibleEntries.map((entry) => (
              <StaggerRow
                key={`${entry.param}-${entry.changed_at}`}
                className="border-t border-border/50 text-foreground transition-colors hover:bg-surface/60"
              >
                <td className="px-4 py-3 text-foreground-muted whitespace-nowrap">{formatDate(entry.changed_at)}</td>
                <td className="px-4 py-3 font-semibold">{entry.param}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <span className="text-foreground-muted">{formatMetric(entry.old_value)}</span>
                    <ArrowCircleRightGlyph className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span className="font-bold text-foreground">{formatMetric(entry.new_value)}</span>
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-normal font-sans text-xs text-foreground-muted">
                  {entry.reason}
                </td>
              </StaggerRow>
            ))}
          </StaggerTableBody>
        </table>
      </div>

      {entries.length > visibleCount && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 10)}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-surface-hover hover:border-foreground-muted cursor-pointer font-mono"
          >
            Show More ({entries.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

export function SnapshotsTable({ snapshots }: { snapshots: PnlSnapshotRecord[] }) {
  const [visibleCount, setVisibleCount] = useState(10);

  if (snapshots.length === 0) {
    return <Card variant="muted">No PNL snapshots yet.</Card>;
  }

  const visibleSnapshots = snapshots.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface/40">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-border bg-surface/70 text-foreground-muted uppercase tracking-wider text-[10px] font-mono">
            <tr>
              <th className="px-4 py-3 font-medium">Snapshot</th>
              <th className="px-4 py-3 font-medium">Realized PNL</th>
              <th className="px-4 py-3 font-medium">Unrealized PNL</th>
              <th className="px-4 py-3 font-medium">ROI</th>
              <th className="px-4 py-3 font-medium">Max drawdown</th>
              <th className="px-4 py-3 font-medium">Sharpe-like</th>
            </tr>
          </thead>
          <StaggerTableBody className="font-mono text-xs">
            {visibleSnapshots.map((snap) => (
              <StaggerRow key={snap.snapshot_at} className="border-t border-border/50 text-foreground transition-colors hover:bg-surface/60">
                <td className="px-4 py-3 text-foreground-muted whitespace-nowrap">{formatDate(snap.snapshot_at)}</td>
                <td className="px-4 py-3 font-semibold">{formatMetric(snap.realized_pnl)}</td>
                <td className="px-4 py-3">{formatMetric(snap.unrealized_pnl)}</td>
                <td className="px-4 py-3">{formatMetric(snap.roi_pct, "%")}</td>
                <td className="px-4 py-3">{formatMetric(snap.max_drawdown_pct, "%")}</td>
                <td className="px-4 py-3 font-semibold">{formatMetric(snap.sharpe_like)}</td>
              </StaggerRow>
            ))}
          </StaggerTableBody>
        </table>
      </div>

      {snapshots.length > visibleCount && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 10)}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-surface-hover hover:border-foreground-muted cursor-pointer"
          >
            Show More ({snapshots.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
