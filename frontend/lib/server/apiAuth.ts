import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { pool } from "./db";

/** Agent ids are Solana base58 PDAs (legacy) or 20-byte EVM hex keys. */
export const isAgentPda = (v: unknown): v is string =>
  typeof v === "string" && (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v) || /^0x[a-fA-F0-9]{40}$/.test(v));
export const isEvmAddress = (v: unknown): v is `0x${string}` => typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);
export const isTxHash = (v: unknown): v is `0x${string}` => typeof v === "string" && /^0x[a-fA-F0-9]{64}$/.test(v);
export const isNonEmpty = (v: unknown, max?: number): v is string =>
  typeof v === "string" && v.length > 0 && (max === undefined || v.length <= max);

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const arenaEntryMessage = (seasonId: number, agentPda: string) => `viperx-arena-entry:${seasonId}:${agentPda}`;
export const tuneAgentMessage = (agentPda: string, nonce: string) => `viperx-tune-agent:${agentPda}:${nonce}`;
export const followAgentMessage = (followerPda: string, sourcePda: string, nonce: string) =>
  `viperx-follow-agent:${followerPda}:${sourcePda}:${nonce}`;
export const transitionAgentMessage = (agentPda: string, nonce: string) => `viperx-transition-agent:${agentPda}:${nonce}`;
export const paperAgentMessage = (agentId: string, nonce: string) => `viperx-register-paper-agent:${agentId}:${nonce}`;

export type OwnershipResult = "ok" | "not-found" | "solana-read-only" | "bad-signature";

/**
 * Proves the caller controls the agent's owner wallet: an EVM `signMessage` signature over
 * `message`, checked against the stored owner. Agents owned by Solana wallets are read-only now
 * that ViperX runs on X Layer.
 */
export async function verifyAgentOwnership(agentPda: string, message: string, signature: unknown): Promise<OwnershipResult> {
  const owner: string | undefined = (await pool.query("SELECT owner FROM agents WHERE agent_pda = $1", [agentPda])).rows[0]?.owner;
  if (!owner) return "not-found";
  if (!isEvmAddress(owner)) return "solana-read-only";
  if (typeof signature !== "string" || !signature.startsWith("0x")) return "bad-signature";
  try {
    return (await verifyMessage({ address: owner, message, signature: signature as `0x${string}` })) ? "ok" : "bad-signature";
  } catch {
    return "bad-signature";
  }
}

export function ownershipError(result: Exclude<OwnershipResult, "ok">) {
  if (result === "not-found") return NextResponse.json({ error: "agent not found" }, { status: 404 });
  if (result === "solana-read-only")
    return NextResponse.json({ error: "Solana agents are read-only; ViperX now runs on OKX X Layer" }, { status: 400 });
  return NextResponse.json({ error: "signature does not match this agent's owner" }, { status: 403 });
}
