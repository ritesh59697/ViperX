import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../asyncHandler";
import { pool } from "../db";
import { AGENT_RANKING_COLUMNS, rankAndEnrich, TRADE_COUNTS_LATERAL } from "../scoring";
import { arenaEntryMessage, verifyAgentOwnership } from "../verifyOwnership";

export const arenaRouter = Router();

const AgentPdaSchema = z.string().refine(
  (val) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val) || /^0x[a-fA-F0-9]{40}$/.test(val),
  { message: "must be a valid Solana address or EVM hex address" }
);

const EnterArenaSchema = z.object({
  agentPda: AgentPdaSchema,
  signature: z.string().min(1),
});

/** upcoming | active | ended, derived from now() — never stored, never stale. */
function computeStatus(startsAt: Date, endsAt: Date): "upcoming" | "active" | "ended" {
  const now = new Date();
  if (now < startsAt) return "upcoming";
  if (now >= endsAt) return "ended";
  return "active";
}

arenaRouter.get("/arena/seasons", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.starts_at, s.ends_at, s.created_at,
            count(e.id)::int AS entry_count
     FROM arena_seasons s
     LEFT JOIN arena_entries e ON e.arena_season_id = s.id
     GROUP BY s.id
     ORDER BY s.starts_at DESC`
  );

  const seasons = rows.map((s) => ({
    ...s,
    status: computeStatus(new Date(s.starts_at), new Date(s.ends_at)),
  }));

  res.json({ seasons });
}));

arenaRouter.get("/arena/seasons/:id", asyncHandler(async (req, res) => {
  const seasonId = Number(req.params.id);
  if (!Number.isInteger(seasonId)) {
    res.status(400).json({ error: "season id must be an integer" });
    return;
  }

  const seasonResult = await pool.query("SELECT * FROM arena_seasons WHERE id = $1", [seasonId]);
  const season = seasonResult.rows[0];
  if (!season) {
    res.status(404).json({ error: "season not found" });
    return;
  }

  const startsAt: Date = season.starts_at;
  const endsAt: Date = season.ends_at;

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

  res.json({
    season: { ...season, status: computeStatus(startsAt, endsAt) },
    ranked_count: rankedCount,
    entrants: ranked,
  });
}));

arenaRouter.post("/arena/seasons/:id/enter", asyncHandler(async (req, res) => {
  const seasonId = Number(req.params.id);
  if (!Number.isInteger(seasonId)) {
    res.status(400).json({ error: "season id must be an integer" });
    return;
  }

  const parsed = EnterArenaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { agentPda, signature } = parsed.data;

  const seasonResult = await pool.query("SELECT ends_at FROM arena_seasons WHERE id = $1", [seasonId]);
  const season = seasonResult.rows[0];
  if (!season) {
    res.status(404).json({ error: "season not found" });
    return;
  }
  if (new Date() >= new Date(season.ends_at)) {
    res.status(400).json({ error: "this season has already ended" });
    return;
  }

  const agentCheck = await pool.query("SELECT is_paper FROM agents WHERE agent_pda = $1", [agentPda]);
  if (agentCheck.rows[0]?.is_paper === true) {
    res.status(400).json({ error: "Paper trading agents are not eligible for Arena entry." });
    return;
  }

  const message = arenaEntryMessage(seasonId, agentPda);
  const verified = await verifyAgentOwnership(agentPda, message, signature);
  if (!verified) {
    res.status(403).json({ error: "signature does not match this agent's owner" });
    return;
  }

  await pool.query(
    `INSERT INTO arena_entries (arena_season_id, agent_pda)
     VALUES ($1, $2)
     ON CONFLICT (arena_season_id, agent_pda) DO NOTHING`,
    [seasonId, agentPda]
  );

  res.json({ entered: true, seasonId, agentPda });
}));
