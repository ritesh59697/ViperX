import { NextResponse } from "next/server";
import { pool } from "@/lib/server/db";
import { badRequest, isAgentPda } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

const SUBSCRIPTION_COLUMNS = `
  cs.follower_agent_pda AS "followerAgentPda", fa.name AS "followerAgentName", fa.agent_id AS "followerAgentId",
  cs.source_agent_pda AS "sourceAgentPda", sa.name AS "sourceAgentName", sa.agent_id AS "sourceAgentId",
  cs.size_usd AS "sizeUsd", cs.active`;

/** GET /api/agents/dashboard?owner=<address>: the wallet's agents and their copy subscriptions. */
export async function GET(request: Request) {
  const owner = new URL(request.url).searchParams.get("owner");
  if (!isAgentPda(owner)) return badRequest("owner must be a valid EVM or Solana address");

  const agents = (
    await pool.query(
      `SELECT agent_pda AS "agentPda", agent_id AS "agentId", name, strategy_uri AS "strategyUri",
              vault_pubkey AS "vaultPubkey", status, trade_count AS "tradeCount",
              leaderboard_eligible AS "leaderboardEligible", vault_balance AS "vaultBalance", chain,
              is_paper AS "isPaper", simulated_balance AS "simulatedBalance"
         FROM agents WHERE lower(owner) = lower($1)
        ORDER BY created_at DESC`,
      [owner],
    )
  ).rows;
  const pdas = agents.map((a) => a.agentPda);
  if (pdas.length === 0) return NextResponse.json({ agents, copying: [], followers: [] });

  const query = (side: "follower_agent_pda" | "source_agent_pda") =>
    pool.query(
      `SELECT ${SUBSCRIPTION_COLUMNS}
         FROM copy_subscriptions cs
         JOIN agents fa ON cs.follower_agent_pda = fa.agent_pda
         JOIN agents sa ON cs.source_agent_pda = sa.agent_pda
        WHERE cs.${side} = ANY($1) AND cs.active = true`,
      [pdas],
    );
  const [copying, followers] = await Promise.all([query("follower_agent_pda"), query("source_agent_pda")]);
  return NextResponse.json({ agents, copying: copying.rows, followers: followers.rows });
}
