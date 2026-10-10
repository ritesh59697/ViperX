import { keccak256, stringToBytes } from "viem";

/** Deterministic 20-byte id for a Base agent. Unique per (owner, agentId). */
export function baseAgentKey(owner: string, agentId: string): `0x${string}` {
  const hash = keccak256(stringToBytes(`${owner.toLowerCase()}:${agentId}`));
  return `0x${hash.slice(2, 42)}`;
}
