import { pool } from "./db";

export const MIN_TRADES_FOR_ELIGIBILITY = 50;

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

export const REAL_TRADE_SQL_PREDICATE = `tx_signature IS NOT NULL AND tx_signature NOT LIKE 'simulated\\_%' AND tx_signature NOT LIKE 'paper\\_%' AND tx_signature NOT LIKE 'evm\\_sim\\_%'`;

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
const WASH_TRADE_MAX_DURATION_MS = 10_000;
const MIN_DIVERGENT_TRADES_TO_FLAG = 2;
const MAX_ALLOWED_LEVERAGE = 20.0;
const ABERRANT_LEVERAGE_THRESHOLD = 50.0;
const MIN_TIME_SPAN_HOURS_FOR_50_TRADES = 4.0; // 50 qualifying fills must span >= 4 hours to prevent burst spam

export async function evaluateAntiGamingHeuristics(agentPda: string): Promise<AntiGamingReport> {
  try {
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
    const balanceForLeverage = Math.max(vaultBalance, 1.0);

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

      const impliedLeverage = trade.sizeUsd / balanceForLeverage;
      if (impliedLeverage > ABERRANT_LEVERAGE_THRESHOLD) {
        extremeLeverageTradeCount++;
      } else if (impliedLeverage > MAX_ALLOWED_LEVERAGE) {
        highLeverageTradeCount++;
      }
    }

    const totalTrades = trades.length;
    const microRatio = totalTrades > 0 ? microTradeCount / totalTrades : 0;
    const rapidRatio = totalTrades > 0 ? rapidRoundTripCount / totalTrades : 0;

    const timeSpanHours =
      totalTrades > 1 && maxClosedAt > minOpenedAt
        ? Number(((maxClosedAt - minOpenedAt) / (1000 * 60 * 60)).toFixed(2))
        : 0;

    const passesTimeDiversity = totalTrades < 50 || timeSpanHours >= MIN_TIME_SPAN_HOURS_FOR_50_TRADES;

    let isWashTraded = false;
    const reasons: string[] = [];

    if (totalTrades >= 5 && microRatio > 0.8) {
      isWashTraded = true;
      reasons.push(`${Math.round(microRatio * 100)}% micro-trades (<$5)`);
    }

    if (totalTrades >= 5 && rapidRatio > 0.5) {
      isWashTraded = true;
      reasons.push(`${Math.round(rapidRatio * 100)}% rapid round-trips (<10s)`);
    }

    if (divergentTradeCount >= MIN_DIVERGENT_TRADES_TO_FLAG) {
      isWashTraded = true;
      reasons.push(`${divergentTradeCount} trades with divergence >$0.50`);
    }

    if (extremeLeverageTradeCount > 0) {
      isWashTraded = true;
      reasons.push(`${extremeLeverageTradeCount} trades with aberrant leverage (>50x vault balance)`);
    } else if (highLeverageTradeCount >= 3) {
      isWashTraded = true;
      reasons.push(`${highLeverageTradeCount} trades exceeding 20x max leverage limit`);
    }

    if (totalTrades >= 50 && !passesTimeDiversity) {
      isWashTraded = true;
      reasons.push(`Track record compressed into ${timeSpanHours}h (<${MIN_TIME_SPAN_HOURS_FOR_50_TRADES}h required across 50 qualifying fills)`);
    }

    return {
      isWashTraded,
      validTradeCount,
      microTradeCount,
      divergentTradeCount,
      timeSpanHours,
      passesTimeDiversity,
      flaggedReason: reasons.length > 0 ? reasons.join("; ") : null,
    };
  } catch {
    return {
      isWashTraded: false,
      validTradeCount: 0,
      microTradeCount: 0,
      divergentTradeCount: 0,
      timeSpanHours: 0,
      passesTimeDiversity: true,
      flaggedReason: null,
    };
  }
}

export async function rankAndEnrich(rows: any[]) {
  const enrichedAgents = await Promise.all(
    rows.map(async (agent) => {
      const antiGaming = await evaluateAntiGamingHeuristics(agent.agent_pda);
      return {
        ...agent,
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

const WINDOW_INTERVALS: Record<string, string | null> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  all: null,
};

const CACHE_TTL_MS = 15_000;
const leaderboardCache = new Map<string, { data: any; expiresAt: number }>();
const agentDetailCache = new Map<string, { data: any; expiresAt: number }>();

export async function getLeaderboardFromDb(windowStr: string = "all") {
  const cached = leaderboardCache.get(windowStr);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const interval = WINDOW_INTERVALS[windowStr] || null;

  const { rows } = await pool.query(
    `SELECT ${AGENT_RANKING_COLUMNS}
     FROM agents a
     LEFT JOIN LATERAL (
       SELECT roi_pct, sharpe_like, max_drawdown_pct, snapshot_at
       FROM pnl_snapshots p
       WHERE p.agent_pda = a.agent_pda
         AND ($1::text IS NULL OR p.snapshot_at >= now() - $1::interval)
       ORDER BY p.snapshot_at DESC
       LIMIT 1
     ) s ON true
     ${TRADE_COUNTS_LATERAL}
     WHERE a.is_paper = FALSE
       AND a.agent_pda != '0x435f196396e0A8738A9cA22257474f1BBb5C4CaF'
       AND a.name !~* '\\m(nigg[a-z]*|niga[a-z]*)\\M'
     ORDER BY s.sharpe_like DESC NULLS LAST, a.trade_count DESC`,
    [interval]
  );

  const { ranked, rankedCount } = await rankAndEnrich(rows);

  const result = {
    window: windowStr,
    ranked_count: rankedCount,
    agents: ranked,
  };

  leaderboardCache.set(windowStr, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export async function getAgentDetailFromDb(agentPda: string) {
  const cacheKey = agentPda.toLowerCase();
  const cached = agentDetailCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const agentResult = await pool.query("SELECT * FROM agents WHERE agent_pda = $1", [agentPda]);
  const agent = agentResult.rows[0];
  if (!agent) {
    return null;
  }


  const [trades, snapshots, antiGaming, skills, tuningHistory, copyingResult, followersResult] = await Promise.all([
    pool.query(
      `SELECT market_symbol, side, size_usd, entry_price, exit_price,
              opened_at, closed_at, realized_pnl, tx_signature,
              onchain_verified_pnl, verified_at, pnl_divergence_flagged, reason, is_paper
       FROM trades WHERE agent_pda = $1
       ORDER BY opened_at DESC LIMIT 50`,
      [agentPda]
    ),
    pool.query(
      `SELECT snapshot_at, realized_pnl, unrealized_pnl, roi_pct, max_drawdown_pct, sharpe_like, is_paper
       FROM pnl_snapshots WHERE agent_pda = $1
       ORDER BY snapshot_at DESC LIMIT 50`,
      [agentPda]
    ),
    evaluateAntiGamingHeuristics(agentPda),
    pool.query(
      `SELECT skill_key, unlocked_at, source_trade_count
       FROM agent_skills WHERE agent_pda = $1
       ORDER BY unlocked_at ASC`,
      [agentPda]
    ),
    pool.query(
      `SELECT changed_at, param, old_value, new_value, reason
       FROM agent_tuning_history WHERE agent_pda = $1
       ORDER BY changed_at DESC LIMIT 20`,
      [agentPda]
    ),
    pool.query(
      `SELECT cs.source_agent_pda AS "sourceAgentPda",
              a.name AS "sourceAgentName",
              a.agent_id AS "sourceAgentId",
              cs.size_usd AS "sizeUsd"
       FROM copy_subscriptions cs
       JOIN agents a ON cs.source_agent_pda = a.agent_pda
       WHERE cs.follower_agent_pda = $1 AND cs.active = true`,
      [agentPda]
    ),
    pool.query(
      `SELECT cs.follower_agent_pda AS "followerAgentPda",
              a.name AS "followerAgentName",
              a.agent_id AS "followerAgentId",
              cs.size_usd AS "sizeUsd"
       FROM copy_subscriptions cs
       JOIN agents a ON cs.follower_agent_pda = a.agent_pda
       WHERE cs.source_agent_pda = $1 AND cs.active = true`,
      [agentPda]
    ),
  ]);

  const detail = {
    agent,
    antiGaming,
    trades: trades.rows,
    pnlHistory: snapshots.rows,
    skills: skills.rows,
    tuningHistory: tuningHistory.rows,
    copying: copyingResult.rows[0] ?? null,
    followers: followersResult.rows,
  };

  agentDetailCache.set(cacheKey, { data: detail, expiresAt: Date.now() + CACHE_TTL_MS });
  return detail;
}

let platformStatsCache: { data: any; expiresAt: number } | null = null;

export async function getPlatformStatsFromDb() {
  if (platformStatsCache && Date.now() < platformStatsCache.expiresAt) {
    return platformStatsCache.data;
  }

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
  const result = {
    registeredAgents: r.registered_agents,
    realTrades: r.real_trades,
    verifiedTrades: r.verified_trades,
    divergenceFlaggedTrades: r.divergence_flagged_trades,
    rankedAgents: r.ranked_agents,
    minTradesForRank: MIN_TRADES_FOR_ELIGIBILITY,
  };

  platformStatsCache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}

export async function getFlaggedAgentsFromDb() {
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
  return flagged;
}

export async function getRecentTradesFromDb(limit = 6) {
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
  return rows;
}

function computeArenaStatus(startsAt: Date, endsAt: Date): "upcoming" | "active" | "ended" {
  const now = new Date();
  if (now < startsAt) return "upcoming";
  if (now >= endsAt) return "ended";
  return "active";
}

let arenaSeasonsCache: { data: any; expiresAt: number } | null = null;

export async function getArenaSeasonsFromDb() {
  if (arenaSeasonsCache && Date.now() < arenaSeasonsCache.expiresAt) {
    return arenaSeasonsCache.data;
  }

  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.starts_at, s.ends_at, s.created_at,
            count(e.id)::int AS entry_count
     FROM arena_seasons s
     LEFT JOIN arena_entries e ON e.arena_season_id = s.id
     GROUP BY s.id
     ORDER BY s.starts_at DESC`
  );

  const data = rows.map((s) => ({
    id: s.id,
    name: s.name,
    starts_at: s.starts_at instanceof Date ? s.starts_at.toISOString() : s.starts_at,
    ends_at: s.ends_at instanceof Date ? s.ends_at.toISOString() : s.ends_at,
    created_at: s.created_at instanceof Date ? s.created_at.toISOString() : s.created_at,
    entry_count: s.entry_count,
    status: computeArenaStatus(new Date(s.starts_at), new Date(s.ends_at)),
  }));

  arenaSeasonsCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export async function getArenaSeasonDetailFromDb(seasonId: number) {
  const seasonResult = await pool.query("SELECT * FROM arena_seasons WHERE id = $1", [seasonId]);
  const season = seasonResult.rows[0];
  if (!season) {
    return null;
  }

  const startsAt = new Date(season.starts_at);
  const endsAt = new Date(season.ends_at);

  const { rows } = await pool.query(
    `SELECT ${AGENT_RANKING_COLUMNS}
     FROM arena_entries e
     JOIN agents a ON a.agent_pda = e.agent_pda
     LEFT JOIN LATERAL (
       SELECT roi_pct, sharpe_like, max_drawdown_pct, snapshot_at
       FROM pnl_snapshots p
       WHERE p.agent_pda = a.agent_pda
         AND p.snapshot_at >= $2 AND p.snapshot_at < $3
       ORDER BY p.snapshot_at DESC
       LIMIT 1
     ) s ON true
     ${TRADE_COUNTS_LATERAL}
     WHERE e.arena_season_id = $1`,
    [seasonId, startsAt, endsAt]
  );

  const { ranked, rankedCount } = await rankAndEnrich(rows);

  return {
    season: {
      id: season.id,
      name: season.name,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      created_at: season.created_at instanceof Date ? season.created_at.toISOString() : season.created_at,
      entry_count: ranked.length,
      status: computeArenaStatus(startsAt, endsAt),
    },
    ranked_count: rankedCount,
    entrants: ranked,
  };
}


