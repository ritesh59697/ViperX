import * as dotenv from "dotenv";
dotenv.config();

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import idl from "../idl/viperx_agent_registry.json";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (see .env / README)`);
  return value;
}

export const RPC_URL = requireEnv("RPC_URL");
export const REGISTRY_PROGRAM_ID = requireEnv("REGISTRY_PROGRAM_ID");
export const DATABASE_URL = requireEnv("DATABASE_URL");

if (idl.address !== REGISTRY_PROGRAM_ID) {
  throw new Error(
    `REGISTRY_PROGRAM_ID (${REGISTRY_PROGRAM_ID}) does not match idl/viperx_agent_registry.json's address ` +
      `(${idl.address}). Re-vendor the IDL from the root idl/ after any program change.`
  );
}

export const connection = new Connection(RPC_URL, "confirmed");

// This module only ever reads accounts and listens to events — it never
// sends a transaction, so a throwaway keypair is fine as the provider's
// nominal wallet. Anchor's Program constructor requires a wallet, even for
// read-only use.
const readOnlyWallet = new Wallet(Keypair.generate());
export const provider = new AnchorProvider(connection, readOnlyWallet, { commitment: "confirmed" });

// See backend/execution-runtime/src/registryClient.ts for why this is cast
// through a narrow interface rather than typed as Program<typeof idl>: a
// JSON-imported IDL loses the string-literal typing Anchor's Program<IDL>
// needs, since no codegen runs for this module. Anchor still resolves
// everything by the name strings in the real IDL at runtime.
//
// Event names here are camelCase, NOT the PascalCase used in the IDL and in
// Rust (AgentStatusChanged, etc). BorshEventCoder.decode() normalizes the
// name to camelCase before EventManager matches it against listeners keyed
// by whatever string was passed to addEventListener — subscribe with the
// PascalCase IDL name and the internal Map lookup silently misses every
// event forever, no error, callback just never fires. Confirmed by hand:
// decoding a real on-chain AgentStatusChanged log returned
// name: "agentStatusChanged". Loosely-typing this via `as Idl` (see below)
// is exactly why TypeScript never caught the mismatch.
export interface RegistryEventMap {
  agentRegistered: { agent: PublicKey; owner: PublicKey; agentId: string };
  agentStatusChanged: { agent: PublicKey; status: Record<string, object> };
  agentBecameEligible: { agent: PublicKey };
  agentAuthorityChanged: { agent: PublicKey; authority: PublicKey };
}

export interface RegistryProgram {
  account: {
    agent: {
      all(): Promise<{ publicKey: PublicKey; account: Record<string, unknown> }[]>;
      fetch(pda: PublicKey): Promise<Record<string, unknown>>;
    };
  };
  addEventListener<E extends keyof RegistryEventMap>(
    eventName: E,
    callback: (event: RegistryEventMap[E], slot: number, signature: string) => void
  ): number;
  removeEventListener(listenerId: number): Promise<void>;
}

export const registryProgram = new Program(idl as Idl, provider) as unknown as RegistryProgram;
