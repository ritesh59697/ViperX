import { getAgentTrades, insertPnlSnapshot, PnlSnapshotRow, TradeRow } from "./store";

const INITIAL_CAPITAL_USD = 1000;

export interface PerformanceMetrics {
  realizedPnl: number;
  unrealizedPnl: number;
  roiPct: number;
  maxDrawdownPct: number | null;
  sharpeLike: number | null;
}

export function calculateMetrics(
  trades: TradeRow[],
  initialCapital = INITIAL_CAPITAL_USD
): PerformanceMetrics {
  // Strict on-chain trust model: Prioritize verified on-chain PnL over self-reported values
  const closedTrades = trades.filter(
    (t) =>
      t.closedAt &&
      ((t.onchainVerifiedPnl !== undefined && t.onchainVerifiedPnl !== null) ||
        (t.realizedPnl !== undefined && t.realizedPnl !== null))
  );

  if (closedTrades.length === 0) {
    return {
      realizedPnl: 0,
      unrealizedPnl: 0,
      roiPct: 0,
      maxDrawdownPct: 0,
      sharpeLike: null,
    };
  }

  let totalRealizedPnl = 0;
  let peakPortfolio = initialCapital;
  let maxDrawdownPct = 0;
  const returns: number[] = [];

  for (const trade of closedTrades) {
    // Pure on-chain priority: use onchainVerifiedPnl if present, fallback to realizedPnl
    const pnl = Number(trade.onchainVerifiedPnl ?? trade.realizedPnl ?? 0);
    totalRealizedPnl += pnl;

    const currentPortfolio = initialCapital + totalRealizedPnl;
    if (currentPortfolio > peakPortfolio) {
      peakPortfolio = currentPortfolio;
    }

    const drawdown = (peakPortfolio - currentPortfolio) / peakPortfolio;
    if (drawdown > maxDrawdownPct) {
      maxDrawdownPct = drawdown;
    }

    const tradeReturn = pnl / initialCapital;
    returns.push(tradeReturn);
  }

  const roiPct = Number(((totalRealizedPnl / initialCapital) * 100).toFixed(2));
  const maxDrawdownFormatted = Number((maxDrawdownPct * 100).toFixed(2));

  // Sharpe-like calculation (Risk-adjusted returns ratio)
  let sharpeLike: number | null = null;
  if (returns.length >= 2) {
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev > 0) {
      sharpeLike = Number(((meanReturn / stdDev) * Math.sqrt(returns.length)).toFixed(2));
    } else {
      sharpeLike = 0;
    }
  }

  return {
    realizedPnl: Number(totalRealizedPnl.toFixed(2)),
    unrealizedPnl: 0, // 0 for closed position snapshots
    roiPct,
    maxDrawdownPct: maxDrawdownFormatted,
    sharpeLike,
  };
}

export async function updateAgentMetrics(agentPda: string): Promise<PnlSnapshotRow> {
  const trades = await getAgentTrades(agentPda);
  const metrics = calculateMetrics(trades);

  const snapshot: PnlSnapshotRow = {
    agentPda,
    snapshotAt: new Date(),
    realizedPnl: metrics.realizedPnl,
    unrealizedPnl: metrics.unrealizedPnl,
    roiPct: metrics.roiPct,
    maxDrawdownPct: metrics.maxDrawdownPct,
    sharpeLike: metrics.sharpeLike,
  };

  await insertPnlSnapshot(snapshot);
  return snapshot;
}
