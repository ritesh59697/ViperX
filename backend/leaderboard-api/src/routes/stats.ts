import { Router } from "express";
import { asyncHandler } from "../asyncHandler";
import { pool } from "../db";
import { evaluateAntiGamingHeuristics } from "../antiGaming";
import { MIN_TRADES_FOR_ELIGIBILITY, REAL_TRADE_SQL_PREDICATE } from "../scoring";

export const statsRouter = Router();

/**
 * Real platform-wide counters for the landing page's headline stats. These
 * replaced a hardcoded array that overstated the platform ("500+ trades",
 * "24/7 uptime") — a claim a grant reviewer can trivially check against the
 * public leaderboard, so it has to come from the same Postgres the
 * leaderboard ranks on.
 *
 * `verifiedTrades` is the number worth leading with: closes that
 * pnl-indexer's velocityWatcher independently confirmed against on-chain
 * PerpPosition.settledPnl, not merely self-reported by execution-runtime.
 */
statsRouter.get("/stats", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*) FROM agents)::int AS registered_agents,
       (SELECT count(*) FROM trades
         WHERE closed_at IS NOT NULL AND ${REAL_TRADE_SQL_PREDICATE})::int AS real_trades,
       (SELECT count(*) FROM trades
         WHERE onchain_verified_pnl IS NOT NULL)::int AS verified_trades,
       (SELECT count(*) FROM trades
         WHERE pnl_divergence_flagged = true)::int AS divergence_flagged_trades,
       (SELECT count(*) FROM agents a
         WHERE a.leaderboard_eligible = true
           AND a.trade_count >= $1
           AND (SELECT count(*) FROM trades t
                 WHERE t.agent_pda = a.agent_pda
                   AND t.onchain_verified_pnl IS NOT NULL) >= $1)::int AS ranked_agents`,
    [MIN_TRADES_FOR_ELIGIBILITY]
  );

  const r = rows[0];
  res.json({
    registeredAgents: r.registered_agents,
    realTrades: r.real_trades,
    verifiedTrades: r.verified_trades,
    divergenceFlaggedTrades: r.divergence_flagged_trades,
    rankedAgents: r.ranked_agents,
    minTradesForRank: MIN_TRADES_FOR_ELIGIBILITY,
  });
}));

/**
 * Agents the anti-gaming heuristics currently flag, with the reason. Powers
 * the landing page's "what the heuristics actually caught" card, which
 * previously showed a hand-written mockup about a nonexistent agent.
 *
 * Deliberately reuses evaluateAntiGamingHeuristics rather than
 * re-implementing the rules, so the card can never claim something the
 * ranking logic doesn't.
 */
statsRouter.get("/flagged-agents", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT agent_pda AS "agentPda", agent_id AS "agentId", name FROM agents`
  );

  const flagged = [];
  for (const row of rows) {
    const result = await evaluateAntiGamingHeuristics(row.agentPda);
    if (result.isWashTraded) {
      flagged.push({
        agentPda: row.agentPda,
        agentId: row.agentId,
        name: row.name,
        flaggedReason: result.flaggedReason,
        validTradeCount: result.validTradeCount,
      });
    }
  }
  res.json({ flagged });
}));

/**
 * The most recent real closed trades across every agent, for the landing
 * page's activity feed. Replaces a Math.random() generator that invented
 * agent names and prices while labelling itself "LIVE ON SOLANA DEVNET".
 *
 * Only real, closed trades — a simulated or still-open row has no business
 * in a feed whose whole claim is that it shows trades that actually
 * happened. `txSignature` is included so each row is independently
 * checkable on a block explorer.
 */
statsRouter.get("/trades/recent", asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 50);
  const { rows } = await pool.query(
    `SELECT t.agent_pda        AS "agentPda",
            a.name             AS "agentName",
            a.agent_id         AS "agentId",
            a.chain            AS "chain",
            t.market_symbol    AS "marketSymbol",
            t.side,
            t.size_usd         AS "sizeUsd",
            t.entry_price      AS "entryPrice",
            t.exit_price       AS "exitPrice",
            t.realized_pnl     AS "realizedPnl",
            t.closed_at        AS "closedAt",
            t.tx_signature     AS "txSignature",
            (t.onchain_verified_pnl IS NOT NULL) AS "onchainVerified",
            t.reason
     FROM trades t
     JOIN agents a ON a.agent_pda = t.agent_pda
     WHERE t.closed_at IS NOT NULL 
       AND ${REAL_TRADE_SQL_PREDICATE} 
       AND (a.chain IS NULL OR a.chain != 'base')
       AND ((a.chain = 'solana' AND t.tx_signature NOT LIKE '0x%') OR a.chain = 'xlayer')
     ORDER BY t.closed_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json({ trades: rows });
}));
