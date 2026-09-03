import { Connection, PublicKey, TransactionSignature } from "@solana/web3.js";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "../idl/viperx_agent_registry.json";

export const REGISTRY_PROGRAM_ID = new PublicKey(idl.address);

// Mirrors programs/viperx_agent_registry/.../src/lib.rs's on-chain limits —
// validate client-side so a form error surfaces before asking for a
// signature, not after the chain rejects it.
export const MAX_AGENT_ID_LEN = 32;
export const MAX_NAME_LEN = 64;
export const MAX_URI_LEN = 200;

// Mirrors Agent::SPACE in lib.rs. Used to sanity-check a fetched account is
// actually a current-layout Agent before trusting its decoded fields — see
// CLAUDE.md's account-layout Gotcha (a stale/wrong-size account can decode
// silently wrong rather than error).
export const AGENT_SPACE =
  8 + 32 + (4 + MAX_AGENT_ID_LEN) + (4 + MAX_NAME_LEN) + (4 + MAX_URI_LEN) + 32 + 32 + 1 + 8 + 1 + 8 + 8 + 1;

// Program<IDL> needs a literal-typed IDL to generate typed methods/accounts;
// a JSON import's string fields widen to `string`, not the literal unions
// Anchor's Idl type requires (no codegen runs for this module). This names
// just the surface this client uses — Anchor still resolves everything by
// the name strings in the real IDL at runtime. Same approach as
// backend/execution-runtime/src/registryClient.ts.
interface RegistryProgram {
  methods: {
    registerAgent(
      agentId: string,
      name: string,
      strategyUri: string,
      vaultPubkey: PublicKey
    ): {
      accounts(accs: {
        owner: PublicKey;
        agent: PublicKey;
        systemProgram: PublicKey;
      }): { rpc(): Promise<TransactionSignature> };
    };
    setAuthority(newAuthority: PublicKey): {
      accounts(accs: { owner: PublicKey; agent: PublicKey }): {
        rpc(): Promise<TransactionSignature>;
      };
    };
  };
  account: {
    agent: {
      fetch(pda: PublicKey): Promise<{ owner: PublicKey; authority: PublicKey }>;
    };
  };
}

/**
 * The execution runtime's own public key, delegated `authority` on an agent
 * so it can call `record_trade`/`authority_pause` without owner keys — see
 * `set_authority` in the Anchor program and CLAUDE.md's Gotchas. Deployment-
 * specific (whichever runtime key operates this instance), so there's no
 * safe default to fall back to; unset disables the delegate-to-runtime step
 * in the create-agent flow rather than pointing at the wrong key silently.
 */
export const RUNTIME_PUBKEY = process.env.NEXT_PUBLIC_RUNTIME_PUBKEY
  ? new PublicKey(process.env.NEXT_PUBLIC_RUNTIME_PUBKEY)
  : null;

export function getAgentPda(owner: PublicKey, agentId: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), owner.toBuffer(), Buffer.from(agentId)],
    REGISTRY_PROGRAM_ID
  );
  return pda;
}

export function getRegistryProgram(connection: Connection, wallet: AnchorWallet): RegistryProgram {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(idl as Idl, provider) as unknown as RegistryProgram;
}
