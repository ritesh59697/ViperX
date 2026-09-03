export const LEADERBOARD_API_URL = process.env.NEXT_PUBLIC_LEADERBOARD_API_URL || "http://localhost:4000";

export type LeaderboardWindow = "24h" | "7d" | "30d" | "all";

export const LEADERBOARD_WINDOWS: LeaderboardWindow[] = ["24h", "7d", "30d", "all"];

export interface LeaderboardAgent {
  agent_pda: string;
  owner: string;
  agent_id: string;
  name: string;
  status: "Active" | "Paused" | "Retired";
  trade_count: string; // pg returns bigint as a string, not a number
  leaderboard_eligible: boolean;
  chain?: string | null;
  roi_pct: string | null;
  sharpe_like: string | null;
  max_drawdown_pct: string | null;
  latest_snapshot_at: string | null;
  wash_trading_flagged?: boolean;
  flagged_reason?: string | null;
  valid_trade_count?: number;
  /** Settled fills (simulated rows excluded). */
  real_trade_count: number | null;
  /** Fills velocityWatcher independently confirmed from on-chain state. */
  verified_trade_count: number | null;
  /**
   * True only when the registry vouches for the agent AND enough fills have
   * been independently verified on-chain. trade_count alone is not enough —
   * record_trade can be looped by the owner without ever trading.
   */
  onchain_verified: boolean;
  /** 1-based position among verified agents; null for everything unranked. */
  rank: number | null;
}

export function getAgentChain(agent: {
  chain?: string | null;
  agent_pda?: string;
  owner?: string;
}): "base" | "solana" {
  const c = agent.chain?.toLowerCase();
  if (c === "base") return "base";
  if (c === "solana") return "solana";
  if (agent.agent_pda?.startsWith("0x") || agent.owner?.startsWith("0x")) return "base";
  return "solana";
}

export interface LeaderboardResponse {
  window: LeaderboardWindow;
  ranked_count: number;
  agents: LeaderboardAgent[];
}

const BLOCKED_AGENT_PDAS = new Set([
  "0x435f196396e0a8738a9ca22257474f1bbb5c4caf",
]);

const BLOCKED_TERMS_REGEX = /\b(nigg[a-z]*|niga[a-z]*)\b/i;

export function isBlockedAgent(agent: {
  agent_pda?: string;
  name?: string;
  agent_id?: string;
  agentPda?: string;
  agentName?: string;
  agentId?: string;
}): boolean {
  const pda = (agent.agent_pda || agent.agentPda || "").toLowerCase();
  if (pda && BLOCKED_AGENT_PDAS.has(pda)) {
    return true;
  }
  const name = agent.name || agent.agentName || "";
  if (name && BLOCKED_TERMS_REGEX.test(name)) {
    return true;
  }
  const id = agent.agent_id || agent.agentId || "";
  if (id && BLOCKED_TERMS_REGEX.test(id)) {
    return true;
  }
  return false;
}

/**
 * `all=true` returns unverified agents alongside the ranked ones. They are not
 * ranked by the API (rank: null) and the page renders them in a separate
 * "pending verification" table — keeping them visible without letting anything
 * unverified occupy a leaderboard position.
 */
export async function fetchLeaderboard(window: LeaderboardWindow): Promise<LeaderboardResponse> {
  const res = await fetch(`${LEADERBOARD_API_URL}/leaderboard?window=${window}&all=true`, { next: { revalidate: 10 } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  const data: LeaderboardResponse = await res.json();
  if (data && Array.isArray(data.agents)) {
    data.agents = data.agents.filter((agent) => !isBlockedAgent(agent));
    data.ranked_count = data.agents.filter((a) => a.onchain_verified).length;
  }
  return data;
}

export interface AgentRecord {
  agent_pda: string;
  owner: string;
  agent_id: string;
  name: string;
  strategy_uri: string | null;
  vault_pubkey: string;
  status: "Active" | "Paused" | "Retired";
  trade_count: string;
  leaderboard_eligible: boolean;
  chain?: string;
  is_paper?: boolean;
  simulated_balance?: string;
  created_at: string;
  updated_at: string;
}

export interface TradeRecord {
  market_symbol: string;
  side: "long" | "short";
  size_usd: string;
  entry_price: string;
  exit_price: string | null;
  opened_at: string;
  closed_at: string | null;
  realized_pnl: string | null;
  tx_signature: string | null;
  reason: string | null;
  is_paper?: boolean;
}

export interface PnlSnapshotRecord {
  snapshot_at: string;
  realized_pnl: string;
  unrealized_pnl: string;
  roi_pct: string;
  max_drawdown_pct: string | null;
  sharpe_like: string | null;
  is_paper?: boolean;
}

export interface SkillRecord {
  skill_key: string;
  unlocked_at: string;
  source_trade_count: string; // pg returns bigint as a string, not a number
}

export interface TuningHistoryEntry {
  changed_at: string;
  param: string;
  old_value: string; // pg returns numeric as a string, not a number
  new_value: string;
  reason: string;
}

export interface AgentDetailResponse {
  agent: AgentRecord;
  trades: TradeRecord[];
  pnlHistory: PnlSnapshotRecord[];
  skills: SkillRecord[];
  tuningHistory: TuningHistoryEntry[];
  copying: {
    sourceAgentPda: string;
    sourceAgentName: string;
    sourceAgentId: string;
    sizeUsd: string;
  } | null;
  followers: {
    followerAgentPda: string;
    followerAgentName: string;
    followerAgentId: string;
    sizeUsd: string;
  }[];
}

export class AgentNotFoundError extends Error {}

export async function fetchAgent(agentPda: string): Promise<AgentDetailResponse> {
  const res = await fetch(`${LEADERBOARD_API_URL}/agents/${encodeURIComponent(agentPda)}`, { cache: "no-store" });
  if (res.status === 404) {
    throw new AgentNotFoundError("agent not found");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  return res.json();
}

/** Numeric strategy knobs a user may tune — mirrors leaderboard-api's
 * UserTunableParamsSchema. `caution` is read-only here (skillEngine.ts's
 * auto-tuning owns it) — deliberately not part of this type. */
export interface StrategyParams {
  thresholdBps?: number;
  windowSize?: number;
  gridSpacingBps?: number;
  rsiLowerThreshold?: number;
  rsiUpperThreshold?: number;
  sizeUsd?: number;
}

export interface MyAgentSummary {
  agent_pda: string;
  agent_id: string;
  name: string;
  strategy_uri: string | null;
  status: "Active" | "Paused" | "Retired";
  trade_count: string;
  leaderboard_eligible: boolean;
}

export async function fetchMyAgents(owner: string): Promise<MyAgentSummary[]> {
  const res = await fetch(`${LEADERBOARD_API_URL}/agents?owner=${owner}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  const { agents } = await res.json();
  return agents;
}

/**
 * Message formats a wallet signs to prove ownership of an agent — MUST match
 * backend/leaderboard-api/src/verifyOwnership.ts's arenaEntryMessage /
 * tuneAgentMessage exactly, or every signature will be rejected.
 */
export const arenaEntryMessage = (seasonId: number, agentPda: string): string =>
  `viperx-arena-entry:${seasonId}:${agentPda}`;
export const tuneAgentMessage = (agentPda: string, nonce: string): string =>
  `viperx-tune-agent:${agentPda}:${nonce}`;
export const followAgentMessage = (followerPda: string, sourcePda: string, nonce: string): string =>
  `viperx-follow-agent:${followerPda}:${sourcePda}:${nonce}`;

/**
 * Makes `followerAgentPda` (an agent the caller owns) mirror
 * `sourceAgentPda`'s trades at `sizeUsd` per mirrored position — see
 * backend/leaderboard-api/src/routes/copySubscriptions.ts. Free in v1: no
 * fee, no escrow, just a signed off-chain relationship execution-runtime
 * resolves at its next restart.
 */
export async function followAgent(
  followerAgentPda: string,
  sourceAgentPda: string,
  sizeUsd: number,
  nonce: string,
  signature: string
): Promise<{ followerAgentPda: string; sourceAgentPda: string; sizeUsd: number; active: boolean }> {
  const res = await fetch(`${LEADERBOARD_API_URL}/agents/${followerAgentPda}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceAgentPda, sizeUsd, nonce, signature }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  return res.json();
}

export interface CopySubscription {
  followerAgentPda: string;
  sourceAgentPda: string;
  /**
   * Postgres NUMERIC, which node-postgres returns as a string to avoid float
   * precision loss — not a number, despite the column type. Coerce before
   * doing arithmetic or comparisons on it.
   */
  sizeUsd: string;
}

/**
 * Reads every active subscription. The endpoint is an unauthenticated bulk
 * read (same openness as GET /leaderboard) with no server-side filter, so
 * callers narrow it themselves — see CopyTradeModal, which intersects this
 * against the caller's own agents to find which one already follows a given
 * source.
 */
export async function fetchCopySubscriptions(): Promise<CopySubscription[]> {
  const res = await fetch(`${LEADERBOARD_API_URL}/copy-subscriptions`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`leaderboard-api returned ${res.status}`);
  }
  const body = (await res.json()) as { subscriptions: CopySubscription[] };
  return body.subscriptions;
}

/**
 * Deactivates an existing subscription. Signs the same message shape
 * `followAgent` does — backend/leaderboard-api/src/routes/copySubscriptions.ts
 * verifies both against `followAgentMessage`. Soft-deletes (`active = false`)
 * rather than removing the row, so re-following later reuses it via the
 * POST route's ON CONFLICT clause.
 */
export async function unfollowAgent(
  followerAgentPda: string,
  sourceAgentPda: string,
  nonce: string,
  signature: string
): Promise<{ followerAgentPda: string; sourceAgentPda: string; active: boolean }> {
  const res = await fetch(
    `${LEADERBOARD_API_URL}/agents/${followerAgentPda}/subscriptions/${sourceAgentPda}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nonce, signature }),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  return res.json();
}

export async function setStrategyParams(
  agentPda: string,
  params: StrategyParams,
  nonce: string,
  signature: string
): Promise<{ params: StrategyParams }> {
  const res = await fetch(`${LEADERBOARD_API_URL}/agents/${agentPda}/params`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, nonce, signature }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  return res.json();
}

export async function fetchStrategyParams(
  agentPda: string
): Promise<{ params: StrategyParams }> {
  const res = await fetch(`${LEADERBOARD_API_URL}/agents/${agentPda}/params`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  return res.json();
}

export interface ArenaSeason {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  status: "upcoming" | "active" | "ended";
  entry_count: number;
}

export async function fetchArenaSeasons(): Promise<ArenaSeason[]> {
  const res = await fetch(`${LEADERBOARD_API_URL}/arena/seasons`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  const { seasons } = await res.json();
  return seasons;
}

export class ArenaSeasonNotFoundError extends Error {}

export interface ArenaSeasonDetail {
  season: ArenaSeason;
  ranked_count: number;
  entrants: LeaderboardAgent[];
}

export async function fetchArenaSeason(id: number): Promise<ArenaSeasonDetail> {
  const res = await fetch(`${LEADERBOARD_API_URL}/arena/seasons/${id}`, { cache: "no-store" });
  if (res.status === 404) {
    throw new ArenaSeasonNotFoundError("season not found");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  const data: ArenaSeasonDetail = await res.json();
  if (data && Array.isArray(data.entrants)) {
    data.entrants = data.entrants.filter((agent) => !isBlockedAgent(agent));
    data.ranked_count = data.entrants.filter((a) => a.onchain_verified).length;
  }
  return data;
}

export async function enterArena(
  seasonId: number,
  agentPda: string,
  signature: string
): Promise<{ entered: boolean }> {
  const res = await fetch(`${LEADERBOARD_API_URL}/arena/seasons/${seasonId}/enter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentPda, signature }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  return res.json();
}

export interface PlatformStats {
  registeredAgents: number;
  realTrades: number;
  verifiedTrades: number;
  divergenceFlaggedTrades: number;
  rankedAgents: number;
  minTradesForRank: number;
}

/**
 * Real platform counters for the landing page. Returns null rather than
 * throwing so the home page degrades to static copy if leaderboard-api is
 * down — same graceful-failure contract the leaderboard page already has.
 */
export async function fetchPlatformStats(): Promise<PlatformStats | null> {
  try {
    const res = await fetch(`${LEADERBOARD_API_URL}/stats`, { next: { revalidate: 10 } });
    if (!res.ok) return null;
    return (await res.json()) as PlatformStats;
  } catch {
    return null;
  }
}

export interface RecentTrade {
  agentPda: string;
  agentName: string;
  agentId: string;
  marketSymbol: string;
  side: string;
  /** Postgres NUMERIC — arrives as a string. Coerce before arithmetic. */
  sizeUsd: string;
  entryPrice: string;
  exitPrice: string | null;
  realizedPnl: string | null;
  closedAt: string;
  txSignature: string;
  onchainVerified: boolean;
  reason?: string | null;
}

/** Recent real closed trades across all agents, newest first. */
export async function fetchRecentTrades(limit = 8): Promise<RecentTrade[]> {
  try {
    const res = await fetch(`${LEADERBOARD_API_URL}/trades/recent?limit=${limit}`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { trades: RecentTrade[] };
    return (body.trades || []).filter(
      (t) => !isBlockedAgent({ agentPda: t.agentPda, name: t.agentName, agentId: t.agentId })
    );
  } catch {
    return [];
  }
}

export interface FlaggedAgent {
  agentPda: string;
  agentId: string;
  name: string;
  flaggedReason: string | null;
  validTradeCount: number;
}

/**
 * Agents the anti-gaming heuristics currently flag. Returns [] on failure so
 * a caller can render nothing rather than crash.
 */
export async function fetchFlaggedAgents(): Promise<FlaggedAgent[]> {
  try {
    const res = await fetch(`${LEADERBOARD_API_URL}/flagged-agents`, { next: { revalidate: 10 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { flagged: FlaggedAgent[] };
    return (body.flagged || []).filter(
      (a) => !isBlockedAgent({ agentPda: a.agentPda, name: a.name, agentId: a.agentId })
    );
  } catch {
    return [];
  }
}

export interface DashboardAgent {
  agentPda: string;
  agentId: string;
  name: string;
  strategyUri: string | null;
  vaultPubkey: string;
  status: "Active" | "Paused" | "Retired";
  tradeCount: string;
  leaderboardEligible: boolean;
  vaultBalance: string;
  chain: string;
  isPaper?: boolean;
  simulatedBalance?: string;
}

export interface CopyRelationship {
  followerAgentPda: string;
  followerAgentName: string;
  followerAgentId: string;
  sourceAgentPda: string;
  sourceAgentName: string;
  sourceAgentId: string;
  sizeUsd: string;
  active: boolean;
}

export interface UserDashboardResponse {
  agents: DashboardAgent[];
  copying: CopyRelationship[];
  followers: CopyRelationship[];
}

export async function fetchUserDashboard(owner: string): Promise<UserDashboardResponse> {
  const res = await fetch(`${LEADERBOARD_API_URL}/agents/dashboard?owner=${owner}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `leaderboard-api returned ${res.status}`);
  }
  return res.json();
}

export async function registerPaperAgent(params: {
  agentId: string;
  name: string;
  strategyUri: string;
  ownerAddress: string;
  chain: "solana" | "base";
  simulatedBalance: number;
  nonce: string;
  signature: string;
}): Promise<{ success: boolean; agentPda: string; message: string }> {
  const res = await fetch(`${LEADERBOARD_API_URL}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to register paper agent: ${res.status}`);
  }
  return res.json();
}

export async function indexOnchainBaseAgent(params: {
  agentId: string;
  name: string;
  strategyUri: string;
  ownerAddress: string;
  vaultAddress: string;
  txHash: string;
}): Promise<{ success: boolean; agentPda: string }> {
  const res = await fetch(`${LEADERBOARD_API_URL}/agents/onchain-base`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `Failed to index Base agent: ${res.status}`);
  }
  return res.json();
}

export async function transitionPaperAgent(
  agentPda: string,
  params: {
    vaultPubkey: string;
    nonce: string;
    signature: string;
  }
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${LEADERBOARD_API_URL}/agents/${agentPda}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to transition agent: ${res.status}`);
  }
  return res.json();
}

