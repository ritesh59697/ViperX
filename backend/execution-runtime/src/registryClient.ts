import { PublicKey, TransactionSignature } from "@solana/web3.js";
import { BN, Idl, Program } from "@coral-xyz/anchor";
import { Pool } from "pg";
import { provider, REGISTRY_PROGRAM_ID, runtimeKeypair } from "./connection";
import idl from "../idl/viperx_agent_registry.json";

export function evmToSolanaPublicKey(address: string): PublicKey {
  const cleanHex = address.startsWith("0x") ? address.slice(2) : address;
  const bytes = Buffer.from(cleanHex, "hex");
  const padded = Buffer.alloc(32);
  bytes.copy(padded, 12);
  return new PublicKey(padded);
}

export function solanaToEvmAddress(pubkey: PublicKey): string {
  const buf = pubkey.toBuffer();
  const evmBytes = buf.slice(12);
  return "0x" + evmBytes.toString("hex");
}

// Anchor 0.30+ takes the program id from idl.address rather than a
// constructor arg. If REGISTRY_PROGRAM_ID disagrees with the vendored IDL,
// that env var would be silently ignored rather than doing what it says —
// fail loudly instead.
if (idl.address !== REGISTRY_PROGRAM_ID) {
  throw new Error(
    `REGISTRY_PROGRAM_ID (${REGISTRY_PROGRAM_ID}) does not match idl/viperx_agent_registry.json's address ` +
      `(${idl.address}). Re-vendor the IDL (see README) or fix the env var.`
  );
}

// Program<IDL> needs a literal-typed IDL to generate .account.agent /
// .methods.recordTrade typings; a JSON import's string fields widen to
// `string`, not the literal unions Anchor's Idl type requires (no codegen
// runs for this module — see README). This interface names just the surface
// this client actually uses; Anchor still resolves everything by the name
// strings in the real IDL at runtime, so this doesn't change behavior.
interface RegistryProgram {
  account: {
    agent: {
      all(): Promise<{ publicKey: PublicKey; account: Record<string, unknown> }[]>;
      fetch(pda: PublicKey): Promise<Record<string, unknown>>;
    };
  };
  methods: {
    recordTrade(): {
      accounts(accs: {
        authority: PublicKey;
        agent: PublicKey;
      }): { rpc(): Promise<TransactionSignature> };
    };
    authorityPause(): {
      accounts(accs: {
        authority: PublicKey;
        agent: PublicKey;
      }): { rpc(): Promise<TransactionSignature> };
    };
  };
}

export type AgentStatus = "active" | "paused" | "retired";

export interface AgentAccount {
  publicKey: PublicKey;
  owner: PublicKey;
  agentId: string;
  name: string;
  strategyUri: string;
  vaultPubkey: PublicKey; // the owner's Drift authority pubkey (see README)
  authority: PublicKey;
  status: AgentStatus;
  tradeCount: BN;
  leaderboardEligible: boolean;
  createdAt: BN;
  updatedAt: BN;
  isPaper?: boolean;
  chain?: "solana" | "base";
}

function statusFromAnchorEnum(raw: unknown): AgentStatus {
  const key = Object.keys(raw as object)[0];
  if (key === "active" || key === "paused" || key === "retired") return key;
  throw new Error(`unrecognized agent status variant: ${JSON.stringify(raw)}`);
}

export class RegistryClient {
  readonly program: RegistryProgram;

  constructor() {
    this.program = new Program(idl as Idl, provider) as unknown as RegistryProgram;
  }

  /**
   * Agents whose status is Active *and* whose on-chain `authority` is this
   * runtime's own key. The has_one = authority check on record_trade would
   * reject any other agent anyway, but filtering client-side avoids wasted
   * RPC calls and fees on agents this runtime was never delegated to.
   */
  async getManagedActiveAgents(): Promise<AgentAccount[]> {
    const all = await this.program.account.agent.all();
    const mine = runtimeKeypair.publicKey.toBase58();

    return all
      .filter((a: { publicKey: PublicKey; account: Record<string, unknown> }) => {
        const authority = a.account.authority as PublicKey;
        const status = statusFromAnchorEnum(a.account.status);
        return authority.toBase58() === mine && status === "active";
      })
      .map((a: { publicKey: PublicKey; account: Record<string, unknown> }) =>
        this.toAgentAccount(a.publicKey, a.account)
      );
  }

  async getAllActiveAgents(): Promise<AgentAccount[]> {
    const all = await this.program.account.agent.all();
    return all
      .filter((a: { publicKey: PublicKey; account: Record<string, unknown> }) => {
        const status = statusFromAnchorEnum(a.account.status);
        return status === "active";
      })
      .map((a: { publicKey: PublicKey; account: Record<string, unknown> }) =>
        this.toAgentAccount(a.publicKey, a.account)
      );
  }

  async getAgent(agentPda: PublicKey): Promise<AgentAccount> {
    const acc = await this.program.account.agent.fetch(agentPda);
    return this.toAgentAccount(agentPda, acc as Record<string, unknown>);
  }

  /**
   * Signed by this runtime's own key as `authority` — not by the agent's
   * owner. Only callable for agents that delegated authority to this key via
   * set_authority; anyone else's agent rejects it on-chain (has_one =
   * authority). This is what keeps trade_count / leaderboard_eligible in
   * sync after each closed Drift position.
   */
  async recordTrade(agentPda: PublicKey): Promise<string> {
    return this.program.methods
      .recordTrade()
      .accounts({ authority: runtimeKeypair.publicKey, agent: agentPda })
      .rpc();
  }

  /**
   * The circuit breaker's actual on-chain effect: same `authority` signer as
   * recordTrade, but this is the one instruction that key can use to move
   * agent.status. It can only go Active -> Paused (enforced on-chain, not
   * just by this client) — reactivating requires the owner's own set_status
   * call. See programs/viperx_agent_registry's authority_pause and
   * CLAUDE.md's circuit-breaker gotcha.
   */
  async authorityPause(agentPda: PublicKey): Promise<string> {
    return this.program.methods
      .authorityPause()
      .accounts({ authority: runtimeKeypair.publicKey, agent: agentPda })
      .rpc();
  }

  async getManagedActiveBaseAgents(pool: Pool): Promise<AgentAccount[]> {
    const res = await pool.query(
      `SELECT agent_pda, owner, agent_id, name, strategy_uri, vault_pubkey, status, trade_count, leaderboard_eligible, created_at, updated_at
       FROM agents
       WHERE chain = 'base' AND LOWER(status) = 'active' AND is_paper = FALSE`
    );
    return res.rows.map((row) => ({
      publicKey: evmToSolanaPublicKey(row.agent_pda),
      owner: evmToSolanaPublicKey(row.owner),
      agentId: row.agent_id,
      name: row.name,
      strategyUri: row.strategy_uri || "",
      vaultPubkey: evmToSolanaPublicKey(row.vault_pubkey),
      authority: PublicKey.default,
      status: row.status.toLowerCase() as AgentStatus,
      tradeCount: new BN(row.trade_count.toString()),
      leaderboardEligible: row.leaderboard_eligible,
      createdAt: new BN(Math.floor(new Date(row.created_at).getTime() / 1000)),
      updatedAt: new BN(Math.floor(new Date(row.updated_at).getTime() / 1000)),
      isPaper: false,
      chain: "base" as const,
    }));
  }

  async getManagedActivePaperAgents(pool: Pool): Promise<AgentAccount[]> {
    const res = await pool.query(
      `SELECT agent_pda, owner, agent_id, name, strategy_uri, vault_pubkey, status, trade_count, leaderboard_eligible, created_at, updated_at
       FROM agents
       WHERE is_paper = TRUE AND LOWER(status) = 'active'`
    );
    return res.rows.map((row) => {
      const parseKey = (str: string) => {
        try {
          return str.startsWith("0x") ? evmToSolanaPublicKey(str) : new PublicKey(str);
        } catch {
          return PublicKey.default;
        }
      };
      return {
        publicKey: parseKey(row.agent_pda),
        owner: parseKey(row.owner),
        agentId: row.agent_id,
        name: row.name,
        strategyUri: row.strategy_uri || "",
        vaultPubkey: parseKey(row.vault_pubkey),
        authority: PublicKey.default,
        status: row.status.toLowerCase() as AgentStatus,
        tradeCount: new BN(row.trade_count.toString()),
        leaderboardEligible: row.leaderboard_eligible,
        createdAt: new BN(Math.floor(new Date(row.created_at).getTime() / 1000)),
        updatedAt: new BN(Math.floor(new Date(row.updated_at).getTime() / 1000)),
        isPaper: true,
      };
    });
  }

  async getAllActiveBaseAgents(pool: Pool): Promise<AgentAccount[]> {
    return this.getManagedActiveBaseAgents(pool);
  }

  private toAgentAccount(publicKey: PublicKey, acc: Record<string, unknown>): AgentAccount {
    return {
      publicKey,
      owner: acc.owner as PublicKey,
      agentId: acc.agentId as string,
      name: acc.name as string,
      strategyUri: acc.strategyUri as string,
      vaultPubkey: acc.vaultPubkey as PublicKey,
      authority: acc.authority as PublicKey,
      status: statusFromAnchorEnum(acc.status),
      tradeCount: acc.tradeCount as BN,
      leaderboardEligible: acc.leaderboardEligible as boolean,
      createdAt: acc.createdAt as BN,
      updatedAt: acc.updatedAt as BN,
      isPaper: false,
    };
  }
}
