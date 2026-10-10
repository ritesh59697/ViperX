import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../asyncHandler";
import { pool } from "../db";
import { AGENT_RANKING_COLUMNS, MIN_TRADES_FOR_ELIGIBILITY, rankAndEnrich, TRADE_COUNTS_LATERAL } from "../scoring";

export const leaderboardRouter = Router();

// Mirrors docs/ROADMAP.md's windows. "all" means no time filter.
const WindowSchema = z.enum(["24h", "7d", "30d", "all"]).default("all");
const WINDOW_INTERVALS: Record<string, string | null> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  all: null,
};

leaderboardRouter.get("/leaderboard", asyncHandler(async (req, res) => {
  const parsed = WindowSchema.safeParse(req.query.window);
  if (!parsed.success) {
    res.status(400).json({ error: "window must be one of: 24h, 7d, 30d, all" });
    return;
  }
  const window = parsed.data;
  const interval = WINDOW_INTERVALS[window];

  const includeAll = req.query.include_all === "true" || req.query.all === "true";

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
       AND ($2::boolean = true OR (a.leaderboard_eligible = true AND a.trade_count >= $3))
     ORDER BY s.sharpe_like DESC NULLS LAST, a.trade_count DESC`,
    [interval, includeAll, MIN_TRADES_FOR_ELIGIBILITY]
  );

  // Verified agents first, then wash-trading flag, then Sharpe. Unverified
  // agents are still returned (the caller may want to show them as pending)
  // but they sort below every verified agent and carry rank: null.
  const { ranked, rankedCount } = await rankAndEnrich(rows);

  res.json({
    window,
    ranked_count: rankedCount,
    agents: ranked,
  });
}));
