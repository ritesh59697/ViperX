import { NextResponse } from "next/server";
import { pool } from "@/lib/server/db";
import {
  badRequest,
  isAgentPda,
  isEvmAddress,
  isNonEmpty,
  ownershipError,
  readJson,
  transitionAgentMessage,
  verifyAgentOwnership,
} from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/:agentPda/transition: mark a paper agent as live with a vault address. It earns
 * verified fills only once it is also registered on chain, since the X Layer indexer attributes
 * fills to registry agents only.
 */
export async function POST(request: Request, props: { params: Promise<{ agentPda: string }> }) {
  const agentPda = decodeURIComponent((await props.params).agentPda);
  if (!isAgentPda(agentPda)) return badRequest("invalid agent id");
  const b = await readJson(request);
  if (!b || !isEvmAddress(b.vaultPubkey) || !isNonEmpty(b.nonce)) return badRequest("vaultPubkey (EVM address) and nonce are required");

  const owned = await verifyAgentOwnership(agentPda, transitionAgentMessage(agentPda, b.nonce), b.signature);
  if (owned !== "ok") return ownershipError(owned);

  await pool.query(
    `UPDATE agents SET is_paper = FALSE, vault_pubkey = $1, status = 'Active', updated_at = now() WHERE agent_pda = $2`,
    [b.vaultPubkey, agentPda],
  );
  return NextResponse.json({ success: true, message: "Agent marked live." });
}
