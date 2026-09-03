"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { StaggerTableBody, StaggerRow } from "@/components/motion/StaggerTable";
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
      <div className="surface overflow-x-auto rounded-xl">
        <table className="w-full text-left text-sm">
          <thead className="t-label border-b border-border">
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
                className="border-t border-border text-foreground transition-colors hover:bg-surface"
              >
                <td className="px-4 py-3">
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
                <td className="px-4 py-3">{formatMetric(trade.size_usd)}</td>
                <td className="px-4 py-3">{formatMetric(trade.entry_price)}</td>
                <td className="px-4 py-3">{formatMetric(trade.exit_price)}</td>
                <td className="px-4 py-3">{formatMetric(trade.realized_pnl)}</td>
                <td className="px-4 py-3 text-foreground-muted">{formatDate(trade.opened_at)}</td>
                <td className="px-4 py-3 font-sans text-xs text-foreground-muted max-w-[200px] truncate whitespace-normal" title={trade.reason || "N/A"}>
                  {trade.reason || "N/A"}
                  {trade.tx_signature && !isSimulated(trade.tx_signature) && (
                    <>
                      {" "}
                      <a
                        href={explorerUrl(trade.tx_signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline decoration-border underline-offset-2"
                      >
                        tx
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
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-surface-hover hover:border-foreground-muted cursor-pointer"
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
      <div className="surface overflow-x-auto rounded-xl">
        <table className="w-full text-left text-sm">
          <thead className="t-label border-b border-border">
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
                className="border-t border-border text-foreground transition-colors hover:bg-surface"
              >
                <td className="px-4 py-3 text-foreground-muted">{formatDate(entry.changed_at)}</td>
                <td className="px-4 py-3">{entry.param}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <span>{formatMetric(entry.old_value)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-foreground-faint shrink-0">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span className="font-bold">{formatMetric(entry.new_value)}</span>
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
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-surface-hover hover:border-foreground-muted cursor-pointer"
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
      <div className="surface overflow-x-auto rounded-xl">
        <table className="w-full text-left text-sm">
          <thead className="t-label border-b border-border">
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
              <StaggerRow key={snap.snapshot_at} className="border-t border-border text-foreground transition-colors hover:bg-surface">
                <td className="px-4 py-3 text-foreground-muted">{formatDate(snap.snapshot_at)}</td>
                <td className="px-4 py-3">{formatMetric(snap.realized_pnl)}</td>
                <td className="px-4 py-3">{formatMetric(snap.unrealized_pnl)}</td>
                <td className="px-4 py-3">{formatMetric(snap.roi_pct, "%")}</td>
                <td className="px-4 py-3">{formatMetric(snap.max_drawdown_pct, "%")}</td>
                <td className="px-4 py-3">{formatMetric(snap.sharpe_like)}</td>
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
