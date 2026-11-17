import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { pool } from "@/lib/server/db";
import { badRequest, isAgentPda, isEvmAddress, isNonEmpty, paperAgentMessage, readJson } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

/** GET /api/agents?owner=<address>: every agent the wallet owns. */
export async function GET(request: Request) {
  const owner = new URL(request.url).searchParams.get("owner");
  if (!isAgentPda(owner)) return badRequest("owner must be a valid EVM or Solana address");
  const { rows } = await pool.query(
    `SELECT agent_pda, agent_id, name, strategy_uri, status, trade_count, leaderboard_eligible, chain,
            is_paper, simulated_balance
       FROM agents WHERE lower(owner) = lower($1)
      ORDER BY created_at DESC`,
    [owner],
  );
  return NextResponse.json({ agents: rows });
}

/**
 * POST /api/agents: register a paper agent (no transaction). The owner proves control of the
 * wallet by signing `viperx-register-paper-agent:<agentId>:<nonce>`.
 */
export async function POST(request: Request) {
  const b = await readJson(request);
  if (!b) return badRequest("invalid JSON body");
  const { agentId, name, strategyUri, ownerAddress, simulatedBalance, nonce, signature } = b;
  if (!isNonEmpty(agentId, 32)) return badRequest("agentId must be 1-32 characters");
  if (!isNonEmpty(name, 64)) return badRequest("name must be 1-64 characters");
  if (!isNonEmpty(strategyUri, 200)) return badRequest("strategyUri must be 1-200 characters");
  if (!isEvmAddress(ownerAddress)) return badRequest("ownerAddress must be an EVM address");
  if (typeof simulatedBalance !== "number" || simulatedBalance < 100 || simulatedBalance > 100000)
    return badRequest("simulatedBalance must be between 100 and 100000");
  if (!isNonEmpty(nonce) || typeof signature !== "string" || !signature.startsWith("0x"))
    return badRequest("nonce and an EVM signature are required");

  let verified = false;
  try {
    verified = await verifyMessage({ address: ownerAddress, message: paperAgentMessage(agentId, nonce), signature: signature as `0x${string}` });
  } catch {
    verified = false;
  }
  if (!verified) return NextResponse.json({ error: "signature verification failed" }, { status: 403 });

  const agentPda = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(20))).toString("hex")}`;
  await pool.query(
    `INSERT INTO agents (agent_pda, owner, agent_id, name, strategy_uri, vault_pubkey, status, trade_count,
                         leaderboard_eligible, chain, is_paper, simulated_balance, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $1, 'Active', 0, false, 'xlayer', true, $6, now(), now())`,
    [agentPda, ownerAddress, agentId, name, strategyUri, simulatedBalance],
  );
  return NextResponse.json({ success: true, agentPda, message: "Paper agent registered." });
}
