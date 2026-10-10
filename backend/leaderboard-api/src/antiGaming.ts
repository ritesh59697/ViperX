import { pool } from "./db";

export interface AntiGamingReport {
  isWashTraded: boolean;
  validTradeCount: number;
  microTradeCount: number;
  divergentTradeCount: number;
  timeSpanHours: number;
  passesTimeDiversity: boolean;
  flaggedReason: string | null;
}

const MIN_TRADE_SIZE_USD = 5.0;
const WASH_TRADE_MAX_DURATION_MS = 10_000; // 10 seconds
const MIN_DIVERGENT_TRADES_TO_FLAG = 2;
const MAX_ALLOWED_LEVERAGE = 20.0;
const ABERRANT_LEVERAGE_THRESHOLD = 50.0;
const MIN_TIME_SPAN_HOURS_FOR_50_TRADES = 4.0; // 50 qualifying fills must span >= 4 hours to prevent burst spam

export async function evaluateAntiGamingHeuristics(agentPda: string): Promise<AntiGamingReport> {
  const [agentRes, tradesRes] = await Promise.all([
    pool.query(
      `SELECT vault_balance::float AS "vaultBalance" FROM agents WHERE agent_pda = $1`,
      [agentPda]
    ),
    pool.query(
      `SELECT size_usd::float AS "sizeUsd", opened_at AS "openedAt", closed_at AS "closedAt",
              realized_pnl::float AS "realizedPnl", pnl_divergence_flagged AS "pnlDivergenceFlagged"
       FROM trades
       WHERE agent_pda = $1 AND closed_at IS NOT NULL
       ORDER BY opened_at ASC`,
      [agentPda]
    ),
  ]);

  const vaultBalance = agentRes.rows[0]?.vaultBalance ?? 0;
  const balanceForLeverage = Math.max(vaultBalance, 1.0); // minimum $1 to prevent division by zero or extreme scaling

  const trades = tradesRes.rows;
  let microTradeCount = 0;
  let rapidRoundTripCount = 0;
  let validTradeCount = 0;
  let divergentTradeCount = 0;
  let highLeverageTradeCount = 0;
  let extremeLeverageTradeCount = 0;
  let minOpenedAt = Number.MAX_SAFE_INTEGER;
  let maxClosedAt = 0;

  for (const trade of trades) {
    if (trade.openedAt) {
      const openMs = new Date(trade.openedAt).getTime();
      if (openMs < minOpenedAt) minOpenedAt = openMs;
    }
    if (trade.closedAt) {
      const closeMs = new Date(trade.closedAt).getTime();
      if (closeMs > maxClosedAt) maxClosedAt = closeMs;
    }

    if (trade.sizeUsd < MIN_TRADE_SIZE_USD) {
      microTradeCount++;
    } else {
      validTradeCount++;
    }

    if (trade.openedAt && trade.closedAt) {
      const durationMs = new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime();
      if (durationMs < WASH_TRADE_MAX_DURATION_MS) {
        rapidRoundTripCount++;
      }
    }

    if (trade.pnlDivergenceFlagged) {
      divergentTradeCount++;
    }

    // Leverage check
    const leverage = trade.sizeUsd / balanceForLeverage;
    if (leverage > ABERRANT_LEVERAGE_THRESHOLD) {
      extremeLeverageTradeCount++;
    } else if (leverage > MAX_ALLOWED_LEVERAGE) {
      highLeverageTradeCount++;
    }
  }

  const timeSpanHours =
    trades.length > 1 && maxClosedAt > minOpenedAt
      ? Number(((maxClosedAt - minOpenedAt) / (1000 * 60 * 60)).toFixed(2))
      : 0;

  // Anti-burst check: agents claiming 50+ fills must span >= 4 distinct hours
  const passesTimeDiversity = trades.length < 50 || timeSpanHours >= MIN_TIME_SPAN_HOURS_FOR_50_TRADES;
  const hasHighLeverageGaming = extremeLeverageTradeCount >= 1 || highLeverageTradeCount >= 3;

  const isWashTraded =
    rapidRoundTripCount >= 5 ||
    (trades.length > 5 && microTradeCount / trades.length > 0.5) ||
    divergentTradeCount >= MIN_DIVERGENT_TRADES_TO_FLAG ||
    hasHighLeverageGaming ||
    (trades.length >= 50 && !passesTimeDiversity);

  let flaggedReason: string | null = null;

  if (rapidRoundTripCount >= 5) {
    flaggedReason = `High frequency rapid round-trips detected (${rapidRoundTripCount} trades <10s)`;
  } else if (trades.length > 5 && microTradeCount / trades.length > 0.5) {
    flaggedReason = `Majority micro-trades below $${MIN_TRADE_SIZE_USD} minimum threshold`;
  } else if (divergentTradeCount >= MIN_DIVERGENT_TRADES_TO_FLAG) {
    flaggedReason = `Self-reported PNL diverges from on-chain-verified PNL on ${divergentTradeCount} trade(s)`;
  } else if (hasHighLeverageGaming) {
    if (extremeLeverageTradeCount >= 1) {
      flaggedReason = `Extreme leverage detected (exceeded ${ABERRANT_LEVERAGE_THRESHOLD}x multiplier)`;
    } else {
      flaggedReason = `Repeated high leverage trades detected (3+ trades exceeding ${MAX_ALLOWED_LEVERAGE}x multiplier)`;
    }
  } else if (trades.length >= 50 && !passesTimeDiversity) {
    flaggedReason = `Track record compressed into ${timeSpanHours}h (<${MIN_TIME_SPAN_HOURS_FOR_50_TRADES}h required across 50 qualifying fills)`;
  }

  return {
    isWashTraded,
    validTradeCount,
    microTradeCount,
    divergentTradeCount,
    timeSpanHours,
    passesTimeDiversity,
    flaggedReason,
  };
}
