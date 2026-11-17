import { pool } from "./db";

/**
 * Performance metrics for one agent, computed only from fills whose transaction was found on
 * chain (trades.tx_found). Same formula as backend/pnl-indexer/src/metrics.ts so ranks stay
 * comparable across chains.
 */
export interface PerformanceMetrics {
  realizedPnl: number;
  roiPct: number;
  maxDrawdownPct: number;
  sharpeLike: number | null;
  verifiedClosedTrades: number;
}

/** Capital the ROI and drawdown percentages are measured against (LEADERBOARD_REFERENCE_CAPITAL_USD). */
export function referenceCapitalUsd(): number {
  const raw = process.env.LEADERBOARD_REFERENCE_CAPITAL_USD;
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) {
    throw new Error("LEADERBOARD_REFERENCE_CAPITAL_USD must be set to a positive number");
  }
  return n;
}

export function calculateMetrics(pnls: number[], capital: number): PerformanceMetrics {
  let total = 0;
  let peak = capital;
  let maxDrawdown = 0;
  const returns: number[] = [];
  for (const pnl of pnls) {
    total += pnl;
    const equity = capital + total;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
    returns.push(pnl / capital);
  }
  let sharpeLike: number | null = null;
  if (returns.length >= 2) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
    const sd = Math.sqrt(variance);
    sharpeLike = sd > 0 ? Number(((mean / sd) * Math.sqrt(returns.length)).toFixed(2)) : 0;
  }
  return {
    realizedPnl: Number(total.toFixed(2)),
    roiPct: Number(((total / capital) * 100).toFixed(2)),
    maxDrawdownPct: Number((maxDrawdown * 100).toFixed(2)),
    sharpeLike,
    verifiedClosedTrades: pnls.length,
  };
}

/**
 * Recomputes an agent's metrics from its verified fills, writes a pnl_snapshots row, and sets
 * trade_count / leaderboard_eligible from the verified count.
 */
export async function refreshAgentMetrics(agentPda: string, minTradesForEligibility: number): Promise<PerformanceMetrics> {
  const { rows } = await pool.query(
    `SELECT onchain_verified_pnl::float AS pnl
       FROM trades
      WHERE agent_pda = $1 AND closed_at IS NOT NULL AND tx_found IS TRUE AND onchain_verified_pnl IS NOT NULL
      ORDER BY closed_at ASC, id ASC`,
    [agentPda],
  );
  const metrics = calculateMetrics(rows.map((r) => Number(r.pnl)), referenceCapitalUsd());
  await pool.query(
    `INSERT INTO pnl_snapshots (agent_pda, snapshot_at, realized_pnl, unrealized_pnl, roi_pct, max_drawdown_pct, sharpe_like)
     VALUES ($1, now(), $2, 0, $3, $4, $5)`,
    [agentPda, metrics.realizedPnl, metrics.roiPct, metrics.maxDrawdownPct, metrics.sharpeLike],
  );
  await pool.query(
    `UPDATE agents SET trade_count = $2, leaderboard_eligible = $3, updated_at = now() WHERE agent_pda = $1`,
    [agentPda, metrics.verifiedClosedTrades, metrics.verifiedClosedTrades >= minTradesForEligibility],
  );
  return metrics;
}
