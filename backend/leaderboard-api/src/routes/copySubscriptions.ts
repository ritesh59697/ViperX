import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../asyncHandler";
import { pool } from "../db";
import { followAgentMessage, verifyAgentOwnership } from "../verifyOwnership";

export const copySubscriptionsRouter = Router();

const AgentPdaSchema = z.string().refine(
  (val) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val) || /^0x[a-fA-F0-9]{40}$/.test(val),
  { message: "must be a valid Solana address or EVM hex address" }
);

// Same bounds as UserTunableParamsSchema.sizeUsd in routes/agents.ts.
const FollowSchema = z.object({
  sourceAgentPda: AgentPdaSchema,
  sizeUsd: z.number().min(5).max(1000),
  nonce: z.string().min(1),
  signature: z.string().min(1),
});

const UnfollowSchema = z.object({
  nonce: z.string().min(1),
  signature: z.string().min(1),
});

copySubscriptionsRouter.post("/agents/:agentPda/subscriptions", asyncHandler(async (req, res) => {
  const pdaParsed = AgentPdaSchema.safeParse(req.params.agentPda);
  if (!pdaParsed.success) {
    res.status(400).json({ error: pdaParsed.error.issues[0].message });
    return;
  }
  const followerAgentPda = pdaParsed.data;

  const bodyParsed = FollowSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.issues[0].message });
    return;
  }
  const { sourceAgentPda, sizeUsd, nonce, signature } = bodyParsed.data;

  if (sourceAgentPda === followerAgentPda) {
    res.status(400).json({ error: "an agent cannot follow itself" });
    return;
  }

  const message = followAgentMessage(followerAgentPda, sourceAgentPda, nonce);
  const verified = await verifyAgentOwnership(followerAgentPda, message, signature);
  if (!verified) {
    res.status(403).json({ error: "signature does not match this agent's owner" });
    return;
  }

  const agentCheck = await pool.query("SELECT is_paper FROM agents WHERE agent_pda = $1 OR agent_pda = $2", [followerAgentPda, sourceAgentPda]);
  if (agentCheck.rows.some(r => r.is_paper === true)) {
    res.status(400).json({ error: "Paper trading agents are completely excluded from copy-trading eligibility." });
    return;
  }

  const sourceExists = await pool.query("SELECT 1 FROM agents WHERE agent_pda = $1 AND is_paper = FALSE", [sourceAgentPda]);
  if (sourceExists.rowCount === 0) {
    res.status(404).json({ error: "source agent not found" });
    return;
  }

  // Blocks chained copying — a follower can only mirror an agent that isn't
  // itself mirroring someone else. Keeps the replay logic in execution-runtime
  // single-hop.
  const sourceIsFollower = await pool.query(
    "SELECT 1 FROM copy_subscriptions WHERE follower_agent_pda = $1 AND active",
    [sourceAgentPda]
  );
  if ((sourceIsFollower.rowCount ?? 0) > 0) {
    res.status(400).json({ error: "source agent is itself following another agent — chained copying isn't supported" });
    return;
  }

  await pool.query(
    `INSERT INTO copy_subscriptions (follower_agent_pda, source_agent_pda, size_usd, active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (follower_agent_pda, source_agent_pda)
     DO UPDATE SET size_usd = EXCLUDED.size_usd, active = true`,
    [followerAgentPda, sourceAgentPda, sizeUsd]
  );

  res.json({ followerAgentPda, sourceAgentPda, sizeUsd, active: true });
}));

copySubscriptionsRouter.delete("/agents/:agentPda/subscriptions/:sourceAgentPda", asyncHandler(async (req, res) => {
  const pdaParsed = AgentPdaSchema.safeParse(req.params.agentPda);
  const sourceParsed = AgentPdaSchema.safeParse(req.params.sourceAgentPda);
  if (!pdaParsed.success || !sourceParsed.success) {
    res.status(400).json({ error: "not a plausible Solana address" });
    return;
  }
  const followerAgentPda = pdaParsed.data;
  const sourceAgentPda = sourceParsed.data;

  const bodyParsed = UnfollowSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.issues[0].message });
    return;
  }
  const { nonce, signature } = bodyParsed.data;

  const message = followAgentMessage(followerAgentPda, sourceAgentPda, nonce);
  const verified = await verifyAgentOwnership(followerAgentPda, message, signature);
  if (!verified) {
    res.status(403).json({ error: "signature does not match this agent's owner" });
    return;
  }

  await pool.query(
    `UPDATE copy_subscriptions SET active = false
     WHERE follower_agent_pda = $1 AND source_agent_pda = $2`,
    [followerAgentPda, sourceAgentPda]
  );

  res.json({ followerAgentPda, sourceAgentPda, active: false });
}));

// Unauthenticated bulk read — same openness as GET /leaderboard. Fetched once
// by execution-runtime at startup to resolve which managed agents are
// followers and who each source agent's followers are.
copySubscriptionsRouter.get("/copy-subscriptions", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT follower_agent_pda AS "followerAgentPda",
            source_agent_pda AS "sourceAgentPda",
            size_usd AS "sizeUsd"
     FROM copy_subscriptions
     WHERE active = true`
  );
  res.json({ subscriptions: rows });
}));
