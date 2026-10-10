import { Pool } from "pg";

// Same $1000 assumption pnl-indexer's own src/metrics.ts uses for ROI — kept
// in sync by convention, not by sharing code (separate npm packages/modules,
// no shared workspace to import across). If one changes, check the other.
const INITIAL_CAPITAL_USD = 1000;

export interface ClosedTrade {
  agentPda: string;
  marketSymbol: string;
  side: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  exitPrice: number;
  openedAt: number;
  txSignature: string;
  reason?: string;
  isPaper?: boolean;
}

/**
 * Inserts a closed trade and refreshes that agent's pnl_snapshots row —
 * shared by execution drivers so the Sharpe/ROI/drawdown math exists in
 * exactly one place. Filters calculations strictly by is_paper flag to
 * keep Paper and Devnet tracks 100% separate.
 */
export async function recordClosedTrade(pool: Pool, trade: ClosedTrade): Promise<void> {
  const isPaper = trade.isPaper || false;
  const pnlUsd = (() => {
    if (!Number.isFinite(trade.entryPrice) || trade.entryPrice === 0) return 0;
    const raw =
      trade.side === "long"
        ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * trade.sizeUsd
        : ((trade.entryPrice - trade.exitPrice) / trade.entryPrice) * trade.sizeUsd;
    return Number.isFinite(raw) ? Number(raw.toFixed(2)) : 0;
  })();

  let resolvedPda = trade.agentPda;
  try {
    const pdaCheck = await pool.query(
      `SELECT agent_pda FROM agents WHERE LOWER(agent_pda) = LOWER($1) LIMIT 1`,
      [trade.agentPda]
    );
    if (pdaCheck.rows[0]?.agent_pda) {
      resolvedPda = pdaCheck.rows[0].agent_pda;
    }
  } catch {
    // fallback to trade.agentPda
  }

  await pool.query(
    `INSERT INTO trades (agent_pda, market_symbol, side, size_usd, entry_price, exit_price, opened_at, closed_at, realized_pnl, tx_signature, reason, is_paper)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      resolvedPda,
      trade.marketSymbol,
      trade.side,
      trade.sizeUsd,
      trade.entryPrice,
      trade.exitPrice,
      new Date(trade.openedAt),
      new Date(),
      pnlUsd,
      trade.txSignature,
      trade.reason || null,
      isPaper,
    ]
  );

  // Update agent's trade count in Postgres (only counts devnet trades to keep leaderboard clean)
  await pool.query(
    `UPDATE agents SET trade_count = (SELECT COUNT(*) FROM trades WHERE agent_pda = $1 AND is_paper = FALSE), updated_at = now() WHERE agent_pda = $1`,
    [resolvedPda]
  );

  // If paper trade, we compute paper metrics. Otherwise, devnet metrics.
  // Real trades are verified on-chain. Mock trades carry 'simulated_' signatures. Paper trades carry 'paper_tx_' signatures.
  let closedTrades: any[] = [];
  if (isPaper) {
    const tradesRes = await pool.query(
      `SELECT realized_pnl::float FROM trades
       WHERE agent_pda = $1 AND closed_at IS NOT NULL AND is_paper = TRUE`,
      [resolvedPda]
    );
    closedTrades = tradesRes.rows;
  } else {
    const tradesRes = await pool.query(
      `SELECT realized_pnl::float FROM trades
       WHERE agent_pda = $1 AND closed_at IS NOT NULL AND is_paper = FALSE
         AND tx_signature IS NOT NULL AND tx_signature NOT LIKE 'simulated\\_%' AND tx_signature NOT LIKE 'paper\\_%'`,
      [resolvedPda]
    );
    closedTrades = tradesRes.rows;
  }

  const pnls = closedTrades.map((r) => r.realized_pnl as number);
  const totalRealized = pnls.reduce((sum, p) => sum + p, 0);
  const roiPct = Number(((totalRealized / INITIAL_CAPITAL_USD) * 100).toFixed(2));

  let peak = 0;
  let runningPnl = 0;
  let maxDrawdownPct = 0;
  for (const p of pnls) {
    runningPnl += p;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak > 0 ? ((peak - runningPnl) / (INITIAL_CAPITAL_USD + peak)) * 100 : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  const sharpe =
    pnls.length >= 2
      ? (() => {
          const mean = totalRealized / pnls.length;
          const variance = pnls.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pnls.length;
          const stdDev = Math.sqrt(variance);
          return stdDev > 0 ? Number((mean / stdDev).toFixed(2)) : 0;
        })()
      : 0;

  await pool.query(
    `INSERT INTO pnl_snapshots (agent_pda, realized_pnl, unrealized_pnl, roi_pct, max_drawdown_pct, sharpe_like, is_paper)
     VALUES ($1, $2, 0, $3, $4, $5, $6)`,
    [resolvedPda, totalRealized, roiPct, Number(maxDrawdownPct.toFixed(2)), sharpe, isPaper]
  );
}
