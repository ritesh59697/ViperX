import { PublicKey } from "@solana/web3.js";
import { connection, registryProgram } from "./connection";
import { AgentRow, AgentStatus, upsertAgent } from "./store";

// programs/viperx_agent_registry/.../src/lib.rs's Agent::SPACE. The
// `authority` field was inserted into the middle of the struct (after
// vault_pubkey, before status) when record_trade was fixed to take a
// delegated authority instead of the owner. Accounts registered before that
// redeploy are still exactly 407 bytes (the old SPACE, with no room for
// authority) and sit right next to 439-byte current accounts on-chain with
// no version marker distinguishing them.
//
// Anchor's Borsh decoder does NOT reject these: owner/agent_id/name/
// strategy_uri come before the inserted field, so they decode correctly,
// but everything after (vault_pubkey, status, trade_count, ...) reads from
// the wrong offset — Pubkey fields accept any 32 bytes, and the shifted
// byte that lands where the status enum discriminant is expected happens to
// often fall in-range (0-2), so this fails *silently* rather than throwing.
// Confirmed by hand: a 407-byte stale account decoded via fetch() returned
// a plausible-looking but wrong status/trade_count/leaderboard_eligible,
// and only surfaced when a set_status call against it failed with
// ConstraintSeeds (the corrupted trade_count/status were never the tell).
//
// Always check raw account length before trusting a decoded Agent.
const AGENT_SPACE = 439;

async function isCurrentLayout(pda: PublicKey): Promise<boolean> {
  const info = await connection.getAccountInfo(pda);
  return info !== null && info.data.length === AGENT_SPACE;
}

/** Batched version of isCurrentLayout for the backfill path — one RPC call
 * for however many agents exist, instead of one per agent. */
async function filterCurrentLayoutPdas(pdas: PublicKey[]): Promise<Set<string>> {
  if (pdas.length === 0) return new Set();
  const infos = await connection.getMultipleAccountsInfo(pdas);
  const current = new Set<string>();
  infos.forEach((info, i) => {
    if (info && info.data.length === AGENT_SPACE) current.add(pdas[i].toBase58());
  });
  return current;
}

function statusFromAnchorEnum(raw: unknown): AgentStatus {
  const key = Object.keys(raw as object)[0];
  if (key === "active") return "Active";
  if (key === "paused") return "Paused";
  if (key === "retired") return "Retired";
  throw new Error(`unrecognized agent status variant: ${JSON.stringify(raw)}`);
}

function toAgentRow(pda: PublicKey, acc: Record<string, unknown>): AgentRow {
  return {
    agentPda: pda.toBase58(),
    owner: (acc.owner as PublicKey).toBase58(),
    agentId: acc.agentId as string,
    name: acc.name as string,
    strategyUri: (acc.strategyUri as string) || null,
    vaultPubkey: (acc.vaultPubkey as PublicKey).toBase58(),
    status: statusFromAnchorEnum(acc.status),
    tradeCount: BigInt((acc.tradeCount as { toString(): string }).toString()),
    leaderboardEligible: acc.leaderboardEligible as boolean,
    createdAt: new Date(Number((acc.createdAt as { toString(): string }).toString()) * 1000),
    updatedAt: new Date(Number((acc.updatedAt as { toString(): string }).toString()) * 1000),
  };
}

/** Fetches every Agent account that exists right now and upserts it. Run
 * this once before subscribing — event listeners only see events emitted
 * *after* they attach, so agents registered earlier (like everything
 * registered before this indexer was ever run) would otherwise never
 * appear. Skips any account whose raw size doesn't match the current
 * layout (see AGENT_SPACE above) rather than ingest silently-corrupted
 * data. */
export async function backfillAgents(): Promise<{ upserted: number; skippedStale: number }> {
  const all = await registryProgram.account.agent.all();
  const currentPdas = await filterCurrentLayoutPdas(all.map((a) => a.publicKey));

  let upserted = 0;
  let skippedStale = 0;
  for (const { publicKey, account } of all) {
    if (!currentPdas.has(publicKey.toBase58())) {
      console.warn(
        `[registry] skipping ${publicKey.toBase58()} — pre-fix account layout ` +
          `(stale 407-byte Agent, not the current ${AGENT_SPACE} bytes); ` +
          `decoding it would silently produce wrong data, see AGENT_SPACE comment`
      );
      skippedStale++;
      continue;
    }
    await upsertAgent(toAgentRow(publicKey, account));
    upserted++;
  }
  return { upserted, skippedStale };
}

/** Re-fetches and upserts a single agent by its PDA — used by every event
 * handler below. Event payloads only carry what changed (e.g.
 * AgentStatusChanged only carries the new status), not the full account, so
 * re-fetching the whole account keeps Postgres consistent with on-chain
 * state without needing to hand-merge partial event data. Skips (with a
 * warning) if the account doesn't match the current layout — see
 * AGENT_SPACE above; in practice this shouldn't fire for live events since
 * only current-layout accounts can emit them, but it's cheap insurance. */
async function refetchAndUpsert(agentPda: PublicKey): Promise<void> {
  if (!(await isCurrentLayout(agentPda))) {
    console.warn(`[registry] skipping ${agentPda.toBase58()} — pre-fix account layout, see AGENT_SPACE comment`);
    return;
  }
  const account = await registryProgram.account.agent.fetch(agentPda);
  await upsertAgent(toAgentRow(agentPda, account));
}

/** Subscribes to the registry program's events going forward. Returns the
 * listener ids so the caller can remove them on shutdown. */
export function subscribeToRegistryEvents(): number[] {
  const listeners: number[] = [];

  listeners.push(
    registryProgram.addEventListener("agentRegistered", (event) => {
      console.log(`[registry] agentRegistered: ${event.agentId} (${event.agent.toBase58()})`);
      refetchAndUpsert(event.agent).catch((err) =>
        console.error(`[registry] failed to upsert ${event.agent.toBase58()} after agentRegistered:`, err)
      );
    })
  );

  listeners.push(
    registryProgram.addEventListener("agentStatusChanged", (event) => {
      console.log(`[registry] agentStatusChanged: ${event.agent.toBase58()}`);
      refetchAndUpsert(event.agent).catch((err) =>
        console.error(`[registry] failed to upsert ${event.agent.toBase58()} after agentStatusChanged:`, err)
      );
    })
  );

  listeners.push(
    registryProgram.addEventListener("agentBecameEligible", (event) => {
      console.log(`[registry] agentBecameEligible: ${event.agent.toBase58()}`);
      refetchAndUpsert(event.agent).catch((err) =>
        console.error(`[registry] failed to upsert ${event.agent.toBase58()} after agentBecameEligible:`, err)
      );
    })
  );

  // agentAuthorityChanged is deliberately not tracked here — the delegated
  // execution-runtime authority is an internal trust-boundary detail (see
  // CLAUDE.md), not something the leaderboard/PNL side needs to expose.

  return listeners;
}
