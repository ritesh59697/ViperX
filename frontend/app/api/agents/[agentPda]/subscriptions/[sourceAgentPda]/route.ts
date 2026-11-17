import { NextResponse } from "next/server";
import { pool } from "@/lib/server/db";
import { badRequest, followAgentMessage, isAgentPda, isNonEmpty, ownershipError, readJson, verifyAgentOwnership } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

/** DELETE /api/agents/:followerPda/subscriptions/:sourcePda { nonce, signature } */
export async function DELETE(request: Request, props: { params: Promise<{ agentPda: string; sourceAgentPda: string }> }) {
  const p = await props.params;
  const followerAgentPda = decodeURIComponent(p.agentPda);
  const sourceAgentPda = decodeURIComponent(p.sourceAgentPda);
  if (!isAgentPda(followerAgentPda) || !isAgentPda(sourceAgentPda)) return badRequest("invalid agent id");
  const b = await readJson(request);
  if (!b || !isNonEmpty(b.nonce)) return badRequest("nonce is required");

  const owned = await verifyAgentOwnership(followerAgentPda, followAgentMessage(followerAgentPda, sourceAgentPda, b.nonce), b.signature);
  if (owned !== "ok") return ownershipError(owned);

  await pool.query(
    `UPDATE copy_subscriptions SET active = false WHERE follower_agent_pda = $1 AND source_agent_pda = $2`,
    [followerAgentPda, sourceAgentPda],
  );
  return NextResponse.json({ followerAgentPda, sourceAgentPda, active: false });
}
