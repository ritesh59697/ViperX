import { NextResponse } from "next/server";
import { pool } from "@/lib/server/db";
import { badRequest, followAgentMessage, isAgentPda, isNonEmpty, ownershipError, readJson, verifyAgentOwnership } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

const SIZE_BOUNDS: [number, number] = [5, 1000];

/** POST /api/agents/:followerPda/subscriptions { sourceAgentPda, sizeUsd, nonce, signature } */
export async function POST(request: Request, props: { params: Promise<{ agentPda: string }> }) {
  const followerAgentPda = decodeURIComponent((await props.params).agentPda);
  if (!isAgentPda(followerAgentPda)) return badRequest("invalid agent id");
  const b = await readJson(request);
  if (!b) return badRequest("invalid JSON body");
  const { sourceAgentPda, sizeUsd, nonce, signature } = b;
  if (!isAgentPda(sourceAgentPda)) return badRequest("invalid source agent id");
  if (typeof sizeUsd !== "number" || sizeUsd < SIZE_BOUNDS[0] || sizeUsd > SIZE_BOUNDS[1])
    return badRequest(`sizeUsd must be between ${SIZE_BOUNDS[0]} and ${SIZE_BOUNDS[1]}`);
  if (!isNonEmpty(nonce)) return badRequest("nonce is required");
  if (sourceAgentPda === followerAgentPda) return badRequest("an agent cannot follow itself");

  const owned = await verifyAgentOwnership(followerAgentPda, followAgentMessage(followerAgentPda, sourceAgentPda, nonce), signature);
  if (owned !== "ok") return ownershipError(owned);

  const paper = await pool.query("SELECT 1 FROM agents WHERE agent_pda = ANY($1) AND is_paper = TRUE", [[followerAgentPda, sourceAgentPda]]);
  if ((paper.rowCount ?? 0) > 0) return badRequest("paper agents cannot copy-trade or be copied");
  const source = await pool.query("SELECT 1 FROM agents WHERE agent_pda = $1 AND is_paper = FALSE", [sourceAgentPda]);
  if ((source.rowCount ?? 0) === 0) return NextResponse.json({ error: "source agent not found" }, { status: 404 });
  const chained = await pool.query("SELECT 1 FROM copy_subscriptions WHERE follower_agent_pda = $1 AND active", [sourceAgentPda]);
  if ((chained.rowCount ?? 0) > 0) return badRequest("source agent is itself following another agent; chained copying isn't supported");

  await pool.query(
    `INSERT INTO copy_subscriptions (follower_agent_pda, source_agent_pda, size_usd, active) VALUES ($1, $2, $3, true)
     ON CONFLICT (follower_agent_pda, source_agent_pda) DO UPDATE SET size_usd = EXCLUDED.size_usd, active = true`,
    [followerAgentPda, sourceAgentPda, sizeUsd],
  );
  return NextResponse.json({ followerAgentPda, sourceAgentPda, sizeUsd, active: true });
}
