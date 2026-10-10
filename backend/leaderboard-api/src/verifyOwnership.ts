import bs58 from "bs58";
import nacl from "tweetnacl";
import { verifyMessage } from "viem";
import { pool } from "./db";

/**
 * Proves the caller controls an agent's `owner` wallet before letting them
 * enter an arena season or tune its strategy params — neither is gated by
 * an on-chain signature (both are plain HTTP writes), so without this any
 * caller could act on any agent_pda. Verifies a standard wallet-adapter
 * `signMessage` signature (ed25519 for Solana, EVM verifyMessage for Base)
 * against the agent's on-chain `owner` address.
 */
export async function verifyAgentOwnership(
  agentPda: string,
  message: string,
  signatureHex: string
): Promise<boolean> {
  const res = await pool.query("SELECT owner FROM agents WHERE agent_pda = $1", [agentPda]);
  const owner: string | undefined = res.rows[0]?.owner;
  if (!owner) return false;

  if (owner.startsWith("0x")) {
    try {
      return await verifyMessage({
        address: owner as `0x${string}`,
        message,
        signature: signatureHex as `0x${string}`,
      });
    } catch {
      return false;
    }
  }

  try {
    const ownerBytes = bs58.decode(owner);
    const signatureBytes = bs58.decode(signatureHex);
    const messageBytes = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, ownerBytes);
  } catch {
    // Malformed base58 input (wrong length, bad alphabet) — treat as
    // unverified rather than letting a decode error 500 the request.
    return false;
  }
}

export const arenaEntryMessage = (seasonId: number, agentPda: string): string =>
  `viperx-arena-entry:${seasonId}:${agentPda}`;

export const tuneAgentMessage = (agentPda: string, nonce: string): string =>
  `viperx-tune-agent:${agentPda}:${nonce}`;

export const followAgentMessage = (followerPda: string, sourcePda: string, nonce: string): string =>
  `viperx-follow-agent:${followerPda}:${sourcePda}:${nonce}`;
