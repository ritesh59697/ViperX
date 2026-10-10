import * as fs from "fs";
import * as dotenv from "dotenv";
import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (see .env / README)`);
  return value;
}

function loadKeypair(path: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export const RPC_URL = requireEnv("RPC_URL");
export const REGISTRY_PROGRAM_ID = requireEnv("REGISTRY_PROGRAM_ID");

export const connection = new Connection(RPC_URL, "confirmed");

// This runtime's own key. Each agent's owner delegates it as `authority` via
// set_authority so record_trade can be called without owner rights — see
// CLAUDE.md and programs/viperx_agent_registry's set_authority instruction.
export const runtimeKeypair = loadKeypair(requireEnv("RUNTIME_KEYPAIR_PATH"));
export const wallet = new Wallet(runtimeKeypair);

export const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
