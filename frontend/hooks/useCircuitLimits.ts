"use client";

import { useEffect, useState } from "react";
import { keccak256, parseAbi, toBytes, toHex, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { XLAYER_CHAIN_ID, XLAYER_CONTRACTS, XLAYER_RISK_GATE } from "@/lib/xlayer";

const GUARDIAN_ABI = parseAbi(["function circuitFor(uint8 check) view returns (address processor, uint256 circuitId, uint32 nIn)"]);
const PROCESSOR_ABI = parseAbi(["function eval(uint256 id, bytes inputs) view returns (bytes outputs)"]);
const VAULT_ABI = parseAbi([
  "function BPS_DENOMINATOR() view returns (uint256)",
  "function markets(bytes32) view returns (bool isActive, bytes32 pythPriceFeedId, uint256 maxOpenInterestLongUsd, uint256 maxOpenInterestShortUsd, uint256 openInterestLongUsd, uint256 openInterestShortUsd, uint256 minPositionSizeUsd, uint256 maxLeverageBps, uint256 maintenanceMarginBps)",
]);
/** ITapeOutCircuitGuardian.Check.LEVERAGE; the circuit's input is leverage x 100. */
const LEVERAGE_CHECK = 0;
const LEVERAGE_SCALE = 100;

/** TapeOutSignal.encode: value packed LSB-first into ceil(nIn/8) bytes. */
function encodeSignal(value: number, nIn: number): `0x${string}` {
  const len = Math.ceil(nIn / 8);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = Math.floor(value / 2 ** (8 * i)) % 256;
  return toHex(bytes);
}

/**
 * The leverage circuit's ceiling, read from the circuit itself: the largest input it passes,
 * found by binary search over processor.eval (a free read, about nIn calls). The limit lives in
 * the netlist on chain, so this is the number the chain enforces, not a copy of it.
 */
async function readLeverageCeiling(client: PublicClient): Promise<number | null> {
  if (XLAYER_RISK_GATE.kind !== "tapeout") return null;
  const [processor, circuitId, nIn] = await client.readContract({
    address: XLAYER_CONTRACTS.circuitGuardian,
    abi: GUARDIAN_ABI,
    functionName: "circuitFor",
    args: [LEVERAGE_CHECK],
  });
  const passes = async (x: number) => {
    const out = await client.readContract({ address: processor, abi: PROCESSOR_ABI, functionName: "eval", args: [circuitId, encodeSignal(x, nIn)] });
    return (parseInt(out.slice(2, 4) || "0", 16) & 1) === 1;
  };
  let lo = 0;
  let hi = 2 ** nIn - 1;
  if (!(await passes(lo))) return null;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (await passes(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo / LEVERAGE_SCALE;
}

async function readVaultCap(client: PublicClient, symbol: string): Promise<number | null> {
  const [bps, market] = await Promise.all([
    client.readContract({ address: XLAYER_CONTRACTS.viperVault, abi: VAULT_ABI, functionName: "BPS_DENOMINATOR" }),
    client.readContract({ address: XLAYER_CONTRACTS.viperVault, abi: VAULT_ABI, functionName: "markets", args: [keccak256(toBytes(symbol))] }),
  ]);
  return market[0] ? Number(market[7]) / Number(bps) : null; // maxLeverageBps
}

let ceilingPromise: Promise<number | null> | null = null;
const capPromises = new Map<string, Promise<number | null>>();

export interface CircuitLimits {
  /** Largest leverage the TapeOut leverage circuit passes, e.g. 20; null while loading or unavailable. */
  circuitMaxLeverage: number | null;
  /** The vault's own per-market leverage cap for `symbol`. */
  vaultMaxLeverage: number | null;
}

export function useCircuitLimits(symbol: string): CircuitLimits {
  const client = usePublicClient({ chainId: XLAYER_CHAIN_ID });
  const [limits, setLimits] = useState<CircuitLimits>({ circuitMaxLeverage: null, vaultMaxLeverage: null });

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    ceilingPromise ??= readLeverageCeiling(client).catch(() => null);
    if (!capPromises.has(symbol)) capPromises.set(symbol, readVaultCap(client, symbol).catch(() => null));
    Promise.all([ceilingPromise, capPromises.get(symbol)!]).then(([circuitMaxLeverage, vaultMaxLeverage]) => {
      if (!cancelled) setLimits({ circuitMaxLeverage, vaultMaxLeverage });
    });
    return () => {
      cancelled = true;
    };
  }, [client, symbol]);

  return limits;
}
