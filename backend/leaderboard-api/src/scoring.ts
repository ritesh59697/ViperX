import { evaluateAntiGamingHeuristics } from "./antiGaming";

export const MIN_TRADES_FOR_ELIGIBILITY = 50;

/** Shape shared by both GET /leaderboard's and the arena's ranking query. */
export const AGENT_RANKING_COLUMNS = `
  a.agent_pda,
  a.owner,
  a.agent_id,
  a.name,
  a.status,
  a.trade_count,
  a.leaderboard_eligible,
  a.chain,
  s.roi_pct,
  s.sharpe_like,
  s.max_drawdown_pct,
  s.snapshot_at AS latest_snapshot_at,
  t.real_trade_count,
  t.verified_trade_count
`;

/**
 * What counts as a real (non-simulated) trade, as a reusable SQL fragment.
 * Exported so anything reporting trade counts uses the same definition the
 * leaderboard ranks on — a second, subtly different predicate elsewhere
 * would let the marketing numbers drift from the ranked ones.
 */
export const REAL_TRADE_SQL_PREDICATE = `tx_signature IS NOT NULL AND tx_signature NOT LIKE 'simulated\\_%' AND tx_signature NOT LIKE 'paper\\_%' AND tx_signature NOT LIKE 'evm\\_sim\\_%'`;

/** Same real/verified trade-count lateral both queries need. */
export const TRADE_COUNTS_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (
        WHERE ${REAL_TRADE_SQL_PREDICATE}
      )::int AS real_trade_count,
      count(*) FILTER (WHERE onchain_verified_pnl IS NOT NULL)::int AS verified_trade_count
    FROM trades tr
    WHERE tr.agent_pda = a.agent_pda AND tr.closed_at IS NOT NULL
  ) t ON true
`;

export interface RankableAgentRow {
  agent_pda: string;
  owner: string;
  agent_id: string;
  name: string;
  status: string;
  trade_count: string | number;
  leaderboard_eligible: boolean;
  chain?: string;
  roi_pct: string | number | null;
  sharpe_like: string | number | null;
  max_drawdown_pct: string | number | null;
  latest_snapshot_at: string | Date | null;
  real_trade_count: number | null;
  verified_trade_count: number | null;
}

/**
 * Shared enrichment/sort/rank logic used by both GET /leaderboard and the
 * arena's season-detail ranking — extracted so a future change to the
 * eligibility gate, anti-gaming wiring, or sort order only needs to happen
 * once. Each caller still runs its own SQL (rolling window + all agents for
 * the leaderboard, a fixed [starts_at, ends_at) + an entrant list for the
 * arena) since those two shapes differ enough that forcing one query to
 * cover both would be more awkward than sharing just this half.
 */
export async function rankAndEnrich(rows: RankableAgentRow[]) {
  const enrichedAgents = await Promise.all(
    rows.map(async (agent) => {
      const antiGaming = await evaluateAntiGamingHeuristics(agent.agent_pda);
      return {
        ...agent,
        // See leaderboard.ts's original comment: leaderboard_eligible alone
        // isn't sufficient since record_trade can be looped without a real
        // fill — a rank additionally requires MIN_TRADES_FOR_ELIGIBILITY
        // fills independently confirmed on-chain by pnl-indexer's
        // velocityWatcher.
        onchain_verified:
          agent.leaderboard_eligible === true &&
          Number(agent.trade_count) >= MIN_TRADES_FOR_ELIGIBILITY &&
          Number(agent.verified_trade_count ?? 0) >= MIN_TRADES_FOR_ELIGIBILITY &&
          antiGaming.passesTimeDiversity,
        wash_trading_flagged: antiGaming.isWashTraded,
        flagged_reason: antiGaming.flaggedReason,
        valid_trade_count: antiGaming.validTradeCount,
        time_span_hours: antiGaming.timeSpanHours,
        passes_time_diversity: antiGaming.passesTimeDiversity,
      };
    })
  );

  enrichedAgents.sort((a, b) => {
    if (a.onchain_verified !== b.onchain_verified) {
      return a.onchain_verified ? -1 : 1;
    }
    if (a.wash_trading_flagged !== b.wash_trading_flagged) {
      return a.wash_trading_flagged ? 1 : -1;
    }
    const sharpeA = Number(a.sharpe_like ?? -999);
    const sharpeB = Number(b.sharpe_like ?? -999);
    return sharpeB - sharpeA;
  });

  let nextRank = 1;
  const ranked = enrichedAgents.map((agent) => ({
    ...agent,
    rank: agent.onchain_verified ? nextRank++ : null,
  }));

  return { ranked, rankedCount: nextRank - 1 };
}
