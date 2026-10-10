import { Pool } from "pg";
import { DATABASE_URL } from "./connection";

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

export type AgentStatus = "Active" | "Paused" | "Retired";

export interface AgentRow {
  agentPda: string;
  owner: string;
  agentId: string;
  name: string;
  strategyUri: string | null;
  vaultPubkey: string;
  status: AgentStatus;
  tradeCount: bigint;
  leaderboardEligible: boolean;
  vaultBalance?: number;
  chain?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TradeRow {
  id?: number;
  agentPda: string;
  marketSymbol: string;
  side: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  exitPrice?: number | null;
  openedAt: Date;
  closedAt?: Date | null;
  realizedPnl?: number | null;
  txSignature?: string | null;
  onchainVerifiedPnl?: number | null;
  verifiedAt?: Date | null;
  pnlDivergenceFlagged?: boolean;
  reason?: string | null;
}

export interface AgentVaultRow {
  agentPda: string;
  vaultPubkey: string;
}

export interface PnlSnapshotRow {
  agentPda: string;
  snapshotAt?: Date;
  realizedPnl: number;
  unrealizedPnl: number;
  roiPct: number;
  maxDrawdownPct: number | null;
  sharpeLike: number | null;
}

export async function upsertAgent(row: AgentRow): Promise<void> {
  await pool.query(
    `INSERT INTO agents
       (agent_pda, owner, agent_id, name, strategy_uri, vault_pubkey, status,
        trade_count, leaderboard_eligible, vault_balance, chain, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (agent_pda) DO UPDATE SET
       owner = EXCLUDED.owner,
       agent_id = EXCLUDED.agent_id,
       name = EXCLUDED.name,
       strategy_uri = EXCLUDED.strategy_uri,
       vault_pubkey = EXCLUDED.vault_pubkey,
       status = EXCLUDED.status,
       trade_count = EXCLUDED.trade_count,
       leaderboard_eligible = EXCLUDED.leaderboard_eligible,
       vault_balance = COALESCE(NULLIF(EXCLUDED.vault_balance, 0), agents.vault_balance),
       chain = COALESCE(EXCLUDED.chain, agents.chain),
       updated_at = EXCLUDED.updated_at`,
    [
      row.agentPda,
      row.owner,
      row.agentId,
      row.name,
      row.strategyUri,
      row.vaultPubkey,
      row.status,
      row.tradeCount.toString(),
      row.leaderboardEligible,
      row.vaultBalance ?? 0,
      row.chain ?? 'solana',
      row.createdAt,
      row.updatedAt,
    ]
  );
}

export async function updateAgentVaultBalance(agentPda: string, balance: number): Promise<void> {
  await pool.query(
    `UPDATE agents SET vault_balance = $1, updated_at = now() WHERE agent_pda = $2`,
    [balance, agentPda]
  );
}

export async function getAgentCount(): Promise<number> {
  const res = await pool.query("SELECT count(*)::int AS count FROM agents");
  return res.rows[0].count;
}

export async function getAllAgentPdas(): Promise<string[]> {
  const res = await pool.query("SELECT agent_pda FROM agents");
  return res.rows.map((r) => r.agent_pda);
}

export async function getAgentsWithVault(): Promise<AgentVaultRow[]> {
  const res = await pool.query(
    `SELECT agent_pda AS "agentPda", vault_pubkey AS "vaultPubkey" FROM agents WHERE chain = 'solana'`
  );
  return res.rows;
}

export async function insertTrade(trade: TradeRow): Promise<number> {
  const res = await pool.query(
    `INSERT INTO trades
       (agent_pda, market_symbol, side, size_usd, entry_price, exit_price, opened_at, closed_at, realized_pnl, tx_signature, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      trade.agentPda,
      trade.marketSymbol,
      trade.side,
      trade.sizeUsd,
      trade.entryPrice,
      trade.exitPrice ?? null,
      trade.openedAt,
      trade.closedAt ?? null,
      trade.realizedPnl ?? null,
      trade.txSignature ?? null,
      trade.reason ?? null,
    ]
  );
  return res.rows[0].id;
}

/**
 * A trade only counts toward published performance if it was actually settled
 * on-chain. `mockDriver.ts` writes rows with a `simulated_<timestamp>` signature
 * so the pipeline can be exercised without funds; those must never reach the
 * metrics that rank agents publicly. A row with no signature at all is equally
 * unverifiable, so it is excluded too.
 *
 * `\_` escapes the underscore, which is otherwise a single-character LIKE
 * wildcard.
 */
export const REAL_TRADE_PREDICATE =
  `tx_signature IS NOT NULL AND tx_signature NOT LIKE 'simulated\\_%' AND tx_signature NOT LIKE 'evm\\_sim\\_%' AND tx_signature NOT LIKE 'paper\\_%'`;

export async function getAgentTrades(agentPda: string): Promise<TradeRow[]> {
  const res = await pool.query(
    `SELECT id, agent_pda AS "agentPda", market_symbol AS "marketSymbol", side,
            size_usd::float AS "sizeUsd", entry_price::float AS "entryPrice",
            exit_price::float AS "exitPrice", opened_at AS "openedAt",
            closed_at AS "closedAt", realized_pnl::float AS "realizedPnl",
            tx_signature AS "txSignature",
            onchain_verified_pnl::float AS "onchainVerifiedPnl",
            verified_at AS "verifiedAt", pnl_divergence_flagged AS "pnlDivergenceFlagged",
            reason
     FROM trades
     WHERE agent_pda = $1 AND ${REAL_TRADE_PREDICATE}
     ORDER BY closed_at ASC NULLS LAST, id ASC`,
    [agentPda]
  );
  return res.rows;
}

// Correlates an on-chain-observed close (velocityWatcher.ts) back to the
// trades rows execution-runtime's self-report already wrote for it. Matched
// by recency rather than tx signature — the watcher observes account-state
// deltas via polling, not the close transaction itself, so it has no
// signature to match on.
//
// Returns EVERY still-unverified closed trade, oldest first, not just the
// newest one. The old single-row version assumed "at most one relevant close
// per agent between polls", which held for this project's
// one-position-at-a-time strategies at normal cadence but broke badly under
// a real attack (scripts/attack-pnl-divergence.ts, 2026-08-06): closes
// arriving faster than the 5s poll piled up, each poll reconciled only the
// newest, and every older row was abandoned permanently since nothing ever
// revisited it. 5 of 7 tampered trades went unverified that way — the
// divergence heuristic still fired, but only by clearing its 2-trade
// minimum with zero margin. The rapid-round-trip heuristic is NOT a reliable
// backstop for this the way that comment assumed: it needs 5+ sub-10s
// trades, so a slower attacker evades it while still outrunning this poll.
export async function getUnverifiedClosedTrades(agentPda: string): Promise<TradeRow[]> {
  const res = await pool.query(
    `SELECT id, agent_pda AS "agentPda", market_symbol AS "marketSymbol", side,
            size_usd::float AS "sizeUsd", entry_price::float AS "entryPrice",
            exit_price::float AS "exitPrice", opened_at AS "openedAt",
            closed_at AS "closedAt", realized_pnl::float AS "realizedPnl",
            tx_signature AS "txSignature"
     FROM trades
     WHERE agent_pda = $1 AND closed_at IS NOT NULL AND verified_at IS NULL
     ORDER BY closed_at ASC`,
    [agentPda]
  );
  return res.rows;
}

export async function setTradeVerification(
  tradeId: number,
  onchainVerifiedPnl: number,
  flagged: boolean
): Promise<void> {
  await pool.query(
    `UPDATE trades
     SET onchain_verified_pnl = $2, verified_at = now(), pnl_divergence_flagged = $3
     WHERE id = $1`,
    [tradeId, onchainVerifiedPnl, flagged]
  );
}

export async function insertPnlSnapshot(snapshot: PnlSnapshotRow): Promise<void> {
  await pool.query(
    `INSERT INTO pnl_snapshots
       (agent_pda, snapshot_at, realized_pnl, unrealized_pnl, roi_pct, max_drawdown_pct, sharpe_like)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      snapshot.agentPda,
      snapshot.snapshotAt ?? new Date(),
      snapshot.realizedPnl,
      snapshot.unrealizedPnl,
      snapshot.roiPct,
      snapshot.maxDrawdownPct,
      snapshot.sharpeLike,
    ]
  );
}

export interface AgentSkillRow {
  skillKey: string;
  unlockedAt: Date;
  sourceTradeCount: number;
}

export interface StrategyParams {
  caution: number;
}

export interface TuningHistoryEntry {
  agentPda: string;
  param: string;
  oldValue: number;
  newValue: number;
  reason: string;
}

/**
 * "Real" trade count for skill/tuning purposes — reuses REAL_TRADE_PREDICATE
 * so a mock/simulated run can't farm skills or drive tuning, same reasoning
 * that already excludes those trades from published leaderboard metrics.
 */
export async function getRealTradeCount(agentPda: string): Promise<number> {
  const res = await pool.query(
    `SELECT count(*)::int AS count FROM trades WHERE agent_pda = $1 AND ${REAL_TRADE_PREDICATE}`,
    [agentPda]
  );
  return res.rows[0].count;
}

export async function getLatestSnapshot(agentPda: string): Promise<PnlSnapshotRow | null> {
  const res = await pool.query(
    `SELECT agent_pda AS "agentPda", snapshot_at AS "snapshotAt",
            realized_pnl::float AS "realizedPnl", unrealized_pnl::float AS "unrealizedPnl",
            roi_pct::float AS "roiPct", max_drawdown_pct::float AS "maxDrawdownPct",
            sharpe_like::float AS "sharpeLike"
     FROM pnl_snapshots WHERE agent_pda = $1
     ORDER BY snapshot_at DESC LIMIT 1`,
    [agentPda]
  );
  return res.rows[0] ?? null;
}

export async function getRecentRealTrades(agentPda: string, limit = 5): Promise<TradeRow[]> {
  const res = await pool.query(
    `SELECT id, agent_pda AS "agentPda", market_symbol AS "marketSymbol", side,
            size_usd::float AS "sizeUsd", entry_price::float AS "entryPrice",
            exit_price::float AS "exitPrice", opened_at AS "openedAt",
            closed_at AS "closedAt", realized_pnl::float AS "realizedPnl",
            tx_signature AS "txSignature", reason
     FROM trades
     WHERE agent_pda = $1 AND closed_at IS NOT NULL AND ${REAL_TRADE_PREDICATE}
     ORDER BY closed_at DESC
     LIMIT $2`,
    [agentPda, limit]
  );
  return res.rows;
}

export async function getAgentSkills(agentPda: string): Promise<AgentSkillRow[]> {
  const res = await pool.query(
    `SELECT skill_key AS "skillKey", unlocked_at AS "unlockedAt", source_trade_count AS "sourceTradeCount"
     FROM agent_skills WHERE agent_pda = $1 ORDER BY unlocked_at ASC`,
    [agentPda]
  );
  return res.rows;
}

/** Returns true if this call newly unlocked the skill, false if already unlocked. */
export async function unlockSkill(
  agentPda: string,
  skillKey: string,
  sourceTradeCount: number
): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO agent_skills (agent_pda, skill_key, source_trade_count)
     VALUES ($1, $2, $3)
     ON CONFLICT (agent_pda, skill_key) DO NOTHING
     RETURNING id`,
    [agentPda, skillKey, sourceTradeCount]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getStrategyParams(agentPda: string): Promise<StrategyParams> {
  const res = await pool.query(
    `SELECT params FROM agent_strategy_params WHERE agent_pda = $1`,
    [agentPda]
  );
  return res.rows[0]?.params ?? { caution: 0 };
}

export async function upsertStrategyParams(agentPda: string, params: StrategyParams): Promise<void> {
  await pool.query(
    `INSERT INTO agent_strategy_params (agent_pda, params, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (agent_pda) DO UPDATE SET params = EXCLUDED.params, updated_at = EXCLUDED.updated_at`,
    [agentPda, params]
  );
}

export async function insertTuningHistory(entry: TuningHistoryEntry): Promise<void> {
  await pool.query(
    `INSERT INTO agent_tuning_history (agent_pda, param, old_value, new_value, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.agentPda, entry.param, entry.oldValue, entry.newValue, entry.reason]
  );
}
