/**
 * Single source of truth for ViperX's deployed X Layer contracts.
 *
 * Every address is read from the environment. There are deliberately no hardcoded
 * fallbacks: the previous copies of these addresses, inlined across API routes,
 * components and hooks, all silently went stale the moment the vault was redeployed,
 * and a wrong-but-present address fails far more confusingly than a missing one.
 *
 * Set these in `.env.local` (see `.env.example`), and in the hosting provider for deploys.
 */

import { XLAYER_MARKET_SYMBOLS } from "./trade/marketSymbols";

type Hex = `0x${string}`;

function readAddress(name: string, value: string | undefined): Hex {
  if (!value) {
    throw new Error(
      `${name} is not set. ViperX cannot resolve its X Layer deployment without it — ` +
        `see .env.example and set it in .env.local.`,
    );
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} is not a valid address: ${value}`);
  }
  return value as Hex;
}

function readString(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set — see .env.example and set it in .env.local.`);
  }
  return value;
}

function readId(name: string, value: string | undefined): number {
  const n = Number(readString(name, value));
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} is not a whole number: ${value}`);
  return n;
}

/**
 * The X Layer network ViperX is deployed on. Testnet (1952) and mainnet (196) differ only in these
 * variables, so moving the app between them is an `.env` change.
 */
export const XLAYER_NETWORK = {
  chainId: readId("NEXT_PUBLIC_XLAYER_CHAIN_ID", process.env.NEXT_PUBLIC_XLAYER_CHAIN_ID),
  name: readString("NEXT_PUBLIC_XLAYER_NETWORK_NAME", process.env.NEXT_PUBLIC_XLAYER_NETWORK_NAME),
  rpcUrl: readString("NEXT_PUBLIC_XLAYER_RPC_URL", process.env.NEXT_PUBLIC_XLAYER_RPC_URL),
  explorer: readString("NEXT_PUBLIC_XLAYER_EXPLORER", process.env.NEXT_PUBLIC_XLAYER_EXPLORER),
  testnet: readString("NEXT_PUBLIC_XLAYER_TESTNET", process.env.NEXT_PUBLIC_XLAYER_TESTNET) === "true",
} as const;

export const XLAYER_CHAIN_ID = XLAYER_NETWORK.chainId;
export const XLAYER_EXPLORER = XLAYER_NETWORK.explorer;

/** Explorer link for any address on the configured X Layer network. */
export function xlayerAddressUrl(address: string): string {
  return `${XLAYER_EXPLORER}/address/${address}`;
}

/** Explorer link for a transaction on the configured X Layer network. */
export function xlayerTxUrl(hash: string): string {
  return `${XLAYER_EXPLORER}/tx/${hash}`;
}

/** `0x1234...cdef` — for contract badges, so the label can't drift from the address. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export const XLAYER_CONTRACTS = {
  viperVault: readAddress("NEXT_PUBLIC_XLAYER_VIPER_VAULT", process.env.NEXT_PUBLIC_XLAYER_VIPER_VAULT),
  positionRouter: readAddress(
    "NEXT_PUBLIC_XLAYER_POSITION_ROUTER",
    process.env.NEXT_PUBLIC_XLAYER_POSITION_ROUTER,
  ),
  circuitGuardian: readAddress(
    "NEXT_PUBLIC_XLAYER_CIRCUIT_GUARDIAN",
    process.env.NEXT_PUBLIC_XLAYER_CIRCUIT_GUARDIAN,
  ),
  tapeOutProcessor: readAddress(
    "NEXT_PUBLIC_XLAYER_TAPEOUT_PROCESSOR",
    process.env.NEXT_PUBLIC_XLAYER_TAPEOUT_PROCESSOR,
  ),
  pythPriceAdapter: readAddress(
    "NEXT_PUBLIC_XLAYER_PRICE_ADAPTER",
    process.env.NEXT_PUBLIC_XLAYER_PRICE_ADAPTER,
  ),
  mockUSDC: readAddress("NEXT_PUBLIC_XLAYER_USDC", process.env.NEXT_PUBLIC_XLAYER_USDC),
  mockPythOracle: readAddress("NEXT_PUBLIC_XLAYER_ORACLE", process.env.NEXT_PUBLIC_XLAYER_ORACLE),
} as const;

export type RiskCheck = "leverage" | "slippage" | "drawdown" | "cooldown";

/**
 * The risk gate the vault calls before every trade.
 *
 * - "tapeout": the four TapeOut NAND circuits (X Layer mainnet), one circuit id per check on the
 *   processor. Set NEXT_PUBLIC_XLAYER_CIRCUIT_ID_{LEVERAGE,SLIPPAGE,DRAWDOWN,COOLDOWN}.
 * - "legacy": the earlier testnet gate, a single comparator on a self-hosted processor that is not
 *   a TapeOut circuit. Set NEXT_PUBLIC_XLAYER_CIRCUIT_ID.
 */
export type RiskGate =
  | { kind: "tapeout"; processor: Hex; circuits: Record<RiskCheck, number> }
  | { kind: "legacy"; processor: Hex; circuitId: number };

function readRiskGate(): RiskGate {
  const ids = {
    leverage: process.env.NEXT_PUBLIC_XLAYER_CIRCUIT_ID_LEVERAGE,
    slippage: process.env.NEXT_PUBLIC_XLAYER_CIRCUIT_ID_SLIPPAGE,
    drawdown: process.env.NEXT_PUBLIC_XLAYER_CIRCUIT_ID_DRAWDOWN,
    cooldown: process.env.NEXT_PUBLIC_XLAYER_CIRCUIT_ID_COOLDOWN,
  };
  const set = Object.values(ids).filter(Boolean).length;
  if (set === 4) {
    return {
      kind: "tapeout",
      processor: XLAYER_CONTRACTS.tapeOutProcessor,
      circuits: {
        leverage: readId("NEXT_PUBLIC_XLAYER_CIRCUIT_ID_LEVERAGE", ids.leverage),
        slippage: readId("NEXT_PUBLIC_XLAYER_CIRCUIT_ID_SLIPPAGE", ids.slippage),
        drawdown: readId("NEXT_PUBLIC_XLAYER_CIRCUIT_ID_DRAWDOWN", ids.drawdown),
        cooldown: readId("NEXT_PUBLIC_XLAYER_CIRCUIT_ID_COOLDOWN", ids.cooldown),
      },
    };
  }
  if (set > 0) {
    throw new Error("Set all four NEXT_PUBLIC_XLAYER_CIRCUIT_ID_* variables, or none of them.");
  }
  return {
    kind: "legacy",
    processor: XLAYER_CONTRACTS.tapeOutProcessor,
    circuitId: readId("NEXT_PUBLIC_XLAYER_CIRCUIT_ID", process.env.NEXT_PUBLIC_XLAYER_CIRCUIT_ID),
  };
}

export const XLAYER_RISK_GATE: RiskGate = readRiskGate();

/**
 * Deployment descriptor served by the MCP and A2A endpoints so external agents can
 * discover where ViperX actually lives.
 */
export const XLAYER_DEPLOYMENTS = {
  chainId: XLAYER_CHAIN_ID,
  network: XLAYER_NETWORK.name,
  explorer: XLAYER_EXPLORER,
  contracts: XLAYER_CONTRACTS,
  /** The circuits every trade is evaluated against before it reaches vault liquidity. */
  riskGate: XLAYER_RISK_GATE,
  /**
   * Every market live on the vault, not just the crypto ones — external agents
   * discover tradable markets through here.
   */
  markets: XLAYER_MARKET_SYMBOLS,
} as const;

/** One-line description of the risk gate, for labels: which circuits, on which processor. */
export function riskGateLabel(gate: RiskGate = XLAYER_RISK_GATE): string {
  if (gate.kind === "tapeout") {
    const c = gate.circuits;
    return `TapeOut circuits #${c.leverage} leverage · #${c.slippage} slippage · #${c.drawdown} drawdown · #${c.cooldown} cooldown`;
  }
  return `Testnet gate circuit #${gate.circuitId} (not a TapeOut circuit)`;
}

/** Short badge for the risk gate, e.g. "TAPEOUT ×4" or "TAPE-101". */
export function riskGateBadge(gate: RiskGate = XLAYER_RISK_GATE): string {
  return gate.kind === "tapeout" ? "TAPEOUT ×4" : `TAPE-${gate.circuitId}`;
}
