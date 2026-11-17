import { NextResponse } from "next/server";
import { pool } from "@/lib/server/db";
import { badRequest, isTxHash, readJson } from "@/lib/server/apiAuth";
import { readRegistrationFromTx } from "@/lib/server/xlayerIndexer";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/onchain { txHash }: index an agent the moment its registration confirms, so it
 * shows up before the next indexer run. Every field is read from the transaction's
 * AgentRegistered event on the X Layer registry; nothing the client sends is trusted.
 */
export async function POST(request: Request) {
  const b = await readJson(request);
  const txHash = b?.txHash;
  if (!isTxHash(txHash)) return badRequest("txHash must be a transaction hash");

  const reg = await readRegistrationFromTx(txHash);
  if (!reg) {
    return NextResponse.json(
      { error: "no successful AgentRegistered event from the ViperX registry in that transaction" },
      { status: 422 },
    );
  }
  await pool.query(
    `INSERT INTO agents (agent_pda, owner, agent_id, name, strategy_uri, vault_pubkey, status, trade_count,
                         leaderboard_eligible, chain, is_paper, created_at, updated_at, registry_tx, registry_block)
     VALUES ($1, $2, $3, $4, $5, $6, 'Active', 0, false, 'xlayer', false, $7, now(), $8, $9)
     ON CONFLICT (agent_pda) DO UPDATE SET
       owner = EXCLUDED.owner, agent_id = EXCLUDED.agent_id, name = EXCLUDED.name,
       strategy_uri = EXCLUDED.strategy_uri, vault_pubkey = EXCLUDED.vault_pubkey, chain = 'xlayer',
       is_paper = false, created_at = EXCLUDED.created_at, registry_tx = EXCLUDED.registry_tx,
       registry_block = EXCLUDED.registry_block, updated_at = now()`,
    [reg.agentPda, reg.owner, reg.agentId, reg.name, reg.strategyUri, reg.vault, reg.time, txHash, reg.block.toString()],
  );
  return NextResponse.json({ success: true, agentPda: reg.agentPda, txHash });
}
