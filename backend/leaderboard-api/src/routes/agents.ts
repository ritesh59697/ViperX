import { Router } from "express";
import { z } from "zod";
import { evaluateAntiGamingHeuristics } from "../antiGaming";
import { asyncHandler } from "../asyncHandler";
import { pool } from "../db";
import { tuneAgentMessage, verifyAgentOwnership } from "../verifyOwnership";
import { verifyMessage } from "viem";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { baseAgentKey } from "../baseAgentKey";

export const agentsRouter = Router();

const AgentPdaSchema = z.string().refine(
  (val) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val) || /^0x[a-fA-F0-9]{40}$/.test(val),
  { message: "must be a valid Solana address or EVM hex address" }
);

agentsRouter.get("/agents/dashboard", asyncHandler(async (req, res) => {
  const OwnerSchema = z.string().refine(
    (val) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val) || /^0x[a-fA-F0-9]{40}$/.test(val),
    { message: "owner must be a valid Solana or EVM address" }
  );
  const parsed = OwnerSchema.safeParse(req.query.owner);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const ownerAddress = parsed.data;

  // 1. Fetch user's agents
  const agentsResult = await pool.query(
    `SELECT agent_pda AS "agentPda", agent_id AS "agentId", name, strategy_uri AS "strategyUri", 
            vault_pubkey AS "vaultPubkey", status, trade_count AS "tradeCount", 
            leaderboard_eligible AS "leaderboardEligible", vault_balance AS "vaultBalance", chain,
            is_paper AS "isPaper", simulated_balance AS "simulatedBalance"
     FROM agents WHERE lower(owner) = lower($1)
     ORDER BY created_at DESC`,
    [ownerAddress]
  );
  const userAgents = agentsResult.rows;
  const userPdaList = userAgents.map(a => a.agentPda);

  let copying: any[] = [];
  let followers: any[] = [];

  if (userPdaList.length > 0) {
    // 2. Fetch copy subscriptions where the user's agents are followers
    const copyingResult = await pool.query(
      `SELECT cs.follower_agent_pda AS "followerAgentPda",
              fa.name AS "followerAgentName",
              fa.agent_id AS "followerAgentId",
              cs.source_agent_pda AS "sourceAgentPda",
              sa.name AS "sourceAgentName",
              sa.agent_id AS "sourceAgentId",
              cs.size_usd AS "sizeUsd",
              cs.active
       FROM copy_subscriptions cs
       JOIN agents fa ON cs.follower_agent_pda = fa.agent_pda
       JOIN agents sa ON cs.source_agent_pda = sa.agent_pda
       WHERE cs.follower_agent_pda = ANY($1) AND cs.active = true`,
      [userPdaList]
    );
    copying = copyingResult.rows;

    // 3. Fetch copy subscriptions where the user's agents are sources (being followed)
    const followersResult = await pool.query(
      `SELECT cs.follower_agent_pda AS "followerAgentPda",
              fa.name AS "followerAgentName",
              fa.agent_id AS "followerAgentId",
              cs.source_agent_pda AS "sourceAgentPda",
              sa.name AS "sourceAgentName",
              sa.agent_id AS "sourceAgentId",
              cs.size_usd AS "sizeUsd",
              cs.active
       FROM copy_subscriptions cs
       JOIN agents fa ON cs.follower_agent_pda = fa.agent_pda
       JOIN agents sa ON cs.source_agent_pda = sa.agent_pda
       WHERE cs.source_agent_pda = ANY($1) AND cs.active = true`,
      [userPdaList]
    );
    followers = followersResult.rows;
  }

  res.json({
    agents: userAgents,
    copying,
    followers,
  });
}));

const TRADE_HISTORY_LIMIT = 100;
const SNAPSHOT_HISTORY_LIMIT = 200;
const TUNING_HISTORY_LIMIT = 100;

// Bounds per field — deliberately excludes `caution`, which only
// skillEngine.ts's auto-tuning may set (see CLAUDE.md's Gotchas for why a
// hair-trigger threshold is a real footgun: it churns gas on every tiny
// oracle wobble). zod strips unrecognized keys by default, so a request
// smuggling `caution` in the body is silently dropped, not applied.
const UserTunableParamsSchema = z.object({
  thresholdBps: z.number().min(10).max(500).optional(),
  windowSize: z.number().min(5).max(100).optional(),
  gridSpacingBps: z.number().min(5).max(200).optional(),
  rsiLowerThreshold: z.number().min(5).max(45).optional(),
  rsiUpperThreshold: z.number().min(55).max(95).optional(),
  sizeUsd: z.number().min(5).max(1000).optional(),
});

const SetParamsSchema = z.object({
  params: UserTunableParamsSchema,
  nonce: z.string().min(1),
  signature: z.string().min(1),
});

interface CacheEntry {
  data: any;
  expiresAt: number;
}
const agentDetailCache = new Map<string, CacheEntry>();
const AGENT_CACHE_TTL_MS = 15_000; // 15s in-memory TTL

agentsRouter.get("/agents/:agentPda", asyncHandler(async (req, res) => {
  const parsed = AgentPdaSchema.safeParse(req.params.agentPda);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const agentPda = parsed.data;

  // Fast path: in-memory cache
  const cached = agentDetailCache.get(agentPda);
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.data);
    return;
  }

  const agentResult = await pool.query("SELECT * FROM agents WHERE agent_pda = $1", [agentPda]);
  const agent = agentResult.rows[0];
  if (!agent) {
    res.status(404).json({ error: "agent not found" });
    return;
  }

  const [trades, snapshots, antiGaming, skills, tuningHistory, copyingResult, followersResult] = await Promise.all([
    pool.query(
      `SELECT market_symbol, side, size_usd, entry_price, exit_price,
              opened_at, closed_at, realized_pnl, tx_signature,
              onchain_verified_pnl, verified_at, pnl_divergence_flagged, reason, is_paper
       FROM trades WHERE agent_pda = $1
       ORDER BY opened_at DESC LIMIT $2`,
      [agentPda, TRADE_HISTORY_LIMIT]
    ),
    pool.query(
      `SELECT snapshot_at, realized_pnl, unrealized_pnl, roi_pct, max_drawdown_pct, sharpe_like, is_paper
       FROM pnl_snapshots WHERE agent_pda = $1
       ORDER BY snapshot_at DESC LIMIT $2`,
      [agentPda, SNAPSHOT_HISTORY_LIMIT]
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
       ORDER BY changed_at DESC LIMIT $2`,
      [agentPda, TUNING_HISTORY_LIMIT]
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

  const payload = {
    agent,
    antiGaming,
    trades: trades.rows,
    pnlHistory: snapshots.rows,
    skills: skills.rows,
    tuningHistory: tuningHistory.rows,
    copying: copyingResult.rows[0] ?? null,
    followers: followersResult.rows,
  };

  // Cache response for 15s to keep repeated loads instantaneous
  agentDetailCache.set(agentPda, { data: payload, expiresAt: Date.now() + AGENT_CACHE_TTL_MS });

  res.json(payload);
}));

agentsRouter.get("/agents/:agentPda/params", asyncHandler(async (req, res) => {
  const parsed = AgentPdaSchema.safeParse(req.params.agentPda);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const agentPda = parsed.data;

  const result = await pool.query(
    `SELECT params FROM agent_strategy_params WHERE agent_pda = $1`,
    [agentPda]
  );
  res.json({ params: result.rows[0]?.params ?? { caution: 0 } });
}));

agentsRouter.put("/agents/:agentPda/params", asyncHandler(async (req, res) => {
  const pdaParsed = AgentPdaSchema.safeParse(req.params.agentPda);
  if (!pdaParsed.success) {
    res.status(400).json({ error: pdaParsed.error.issues[0].message });
    return;
  }
  const agentPda = pdaParsed.data;

  const bodyParsed = SetParamsSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.issues[0].message });
    return;
  }
  const { params, nonce, signature } = bodyParsed.data;

  const message = tuneAgentMessage(agentPda, nonce);
  const verified = await verifyAgentOwnership(agentPda, message, signature);
  if (!verified) {
    res.status(403).json({ error: "signature does not match this agent's owner" });
    return;
  }

  const existingResult = await pool.query(
    `SELECT params FROM agent_strategy_params WHERE agent_pda = $1`,
    [agentPda]
  );
  const existing = existingResult.rows[0]?.params ?? { caution: 0 };
  // Merge onto the existing row rather than replacing it outright — this
  // preserves whatever `caution` skillEngine.ts's auto-tuning has already
  // set, since UserTunableParamsSchema never includes that field.
  const merged = { ...existing, ...params };

  await pool.query(
    `INSERT INTO agent_strategy_params (agent_pda, params, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (agent_pda) DO UPDATE SET params = EXCLUDED.params, updated_at = EXCLUDED.updated_at`,
    [agentPda, merged]
  );

  // Record audit history for each changed parameter so it appears in the agent's Tuning Log
  for (const [param, newVal] of Object.entries(params)) {
    if (newVal !== undefined && newVal !== null) {
      const oldVal = (existing as Record<string, number | undefined>)[param] ?? 0;
      if (oldVal !== newVal) {
        await pool.query(
          `INSERT INTO agent_tuning_history (agent_pda, param, old_value, new_value, reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [agentPda, param, oldVal, newVal, `Owner manual adjustment: set ${param} to ${newVal}`]
        );
      }
    }
  }

  // Invalidate cache so updated params are reflected immediately
  agentDetailCache.delete(agentPda);

  res.json({ params: merged });
}));

const CreatePaperAgentSchema = z.object({
  agentId: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  strategyUri: z.string().min(1),
  ownerAddress: z.string().min(1),
  chain: z.enum(["solana", "base"]),
  simulatedBalance: z.number().min(100).max(100000),
  nonce: z.string().min(1),
  signature: z.string().min(1),
});

agentsRouter.post("/agents", asyncHandler(async (req, res) => {
  const parsedBody = CreatePaperAgentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.issues[0].message });
    return;
  }
  const { agentId, name, strategyUri, ownerAddress, chain, simulatedBalance, nonce, signature } = parsedBody.data;

  // Verify signature ownership of ownerAddress
  const message = `viperx-register-paper-agent:${agentId}:${nonce}`;
  let verified = false;
  if (ownerAddress.startsWith("0x")) {
    try {
      verified = await verifyMessage({
        address: ownerAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch {
      verified = false;
    }
  } else {
    try {
      const ownerBytes = bs58.decode(ownerAddress);
      const signatureBytes = bs58.decode(signature);
      const messageBytes = new TextEncoder().encode(message);
      verified = nacl.sign.detached.verify(messageBytes, signatureBytes, ownerBytes);
    } catch {
      verified = false;
    }
  }

  if (!verified) {
    res.status(403).json({ error: "Signature verification failed - unauthorized" });
    return;
  }

  // Generate a random unique agent PDA string
  let agentPda = "";
  if (chain === "solana") {
    agentPda = bs58.encode(nacl.randomBytes(32));
  } else {
    agentPda = "0x" + Buffer.from(nacl.randomBytes(20)).toString("hex");
  }

  await pool.query(
    `INSERT INTO agents (agent_pda, owner, agent_id, name, strategy_uri, vault_pubkey, status, trade_count, leaderboard_eligible, chain, is_paper, simulated_balance, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'Active', 0, false, $7, true, $8, now(), now())`,
    [
      agentPda,
      ownerAddress,
      agentId,
      name,
      strategyUri,
      agentPda, // Vault key points to agentPda for paper
      chain,
      simulatedBalance,
    ]
  );

  res.json({ success: true, agentPda, message: "Paper agent registered successfully!" });
}));

const OnchainBaseAgentSchema = z.object({
  agentId: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  strategyUri: z.string().min(1).max(200),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  vaultAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

agentsRouter.post("/agents/onchain-base", asyncHandler(async (req, res) => {
  const parsedBody = OnchainBaseAgentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.issues[0].message });
    return;
  }
  const { agentId, name, strategyUri, ownerAddress, vaultAddress, txHash } = parsedBody.data;
  const agentPda = baseAgentKey(ownerAddress, agentId);

  await pool.query(
    `INSERT INTO agents
       (agent_pda, owner, agent_id, name, strategy_uri, vault_pubkey, status,
        trade_count, leaderboard_eligible, chain, is_paper, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'Active', 0, false, 'base', false, now(), now())
     ON CONFLICT (agent_pda) DO UPDATE SET
       owner = EXCLUDED.owner,
       agent_id = EXCLUDED.agent_id,
       name = EXCLUDED.name,
       strategy_uri = EXCLUDED.strategy_uri,
       vault_pubkey = EXCLUDED.vault_pubkey,
       chain = 'base',
       is_paper = FALSE,
       updated_at = now()`,
    [agentPda, ownerAddress, agentId, name, strategyUri, vaultAddress]
  );

  res.json({ success: true, agentPda, txHash });
}));

agentsRouter.get("/agents", asyncHandler(async (req, res) => {
  const OwnerSchema = z.string().refine(
    (val) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val) || /^0x[a-fA-F0-9]{40}$/.test(val),
    { message: "owner must be a valid Solana or EVM (Base) address" }
  );
  const parsed = OwnerSchema.safeParse(req.query.owner);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const result = await pool.query(
    `SELECT agent_pda, agent_id, name, strategy_uri, status, trade_count, leaderboard_eligible, chain,
            is_paper, simulated_balance
     FROM agents WHERE lower(owner) = lower($1)
     ORDER BY created_at DESC`,
    [parsed.data]
  );
  res.json({ agents: result.rows });
}));

const TransitionSchema = z.object({
  vaultPubkey: z.string().min(1),
  nonce: z.string().min(1),
  signature: z.string().min(1),
});

agentsRouter.post("/agents/:agentPda/transition", asyncHandler(async (req, res) => {
  const pdaParsed = AgentPdaSchema.safeParse(req.params.agentPda);
  if (!pdaParsed.success) {
    res.status(400).json({ error: pdaParsed.error.issues[0].message });
    return;
  }
  const agentPda = pdaParsed.data;

  const bodyParsed = TransitionSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.issues[0].message });
    return;
  }
  const { vaultPubkey, nonce, signature } = bodyParsed.data;

  const message = `viperx-transition-agent:${agentPda}:${nonce}`;
  const verified = await verifyAgentOwnership(agentPda, message, signature);
  if (!verified) {
    res.status(403).json({ error: "signature does not match this agent's owner" });
    return;
  }

  // Update is_paper to FALSE, and vault_pubkey to the devnet vault.
  await pool.query(
    `UPDATE agents SET is_paper = FALSE, vault_pubkey = $1, status = 'Active', updated_at = now() WHERE agent_pda = $2`,
    [vaultPubkey, agentPda]
  );

  res.json({ success: true, message: "Agent transitioned to Devnet successfully!" });
}));

