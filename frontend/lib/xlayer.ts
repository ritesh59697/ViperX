/**
 * Single source of truth for ViperX's deployed X Layer contracts.
 *
 * Every address is read from the environment. There are deliberately no hardcoded
 * fallbacks: the previous copies of these addresses, inlined across API routes,
 * components and hooks, all silently went stale the moment the vault was redeployed,
 * and a wrong-but-present address fails far more confusingly than a missing one.
 *
 * Set these in `.env.local` (see `.env.example`).
 */

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

/** Chain id for OKX X Layer testnet. */
export const XLAYER_CHAIN_ID = Number(process.env.NEXT_PUBLIC_XLAYER_CHAIN_ID ?? 1952);

export const XLAYER_EXPLORER = "https://www.oklink.com/xlayer-test";

/** Explorer link for any address on X Layer testnet. */
export function xlayerAddressUrl(address: string): string {
  return `${XLAYER_EXPLORER}/address/${address}`;
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

/**
 * Deployment descriptor served by the MCP and A2A endpoints so external agents can
 * discover where ViperX actually lives.
 */
export const XLAYER_DEPLOYMENTS = {
  chainId: XLAYER_CHAIN_ID,
  network: "OKX X Layer Testnet",
  explorer: XLAYER_EXPLORER,
  contracts: XLAYER_CONTRACTS,
  /** The TapeOut circuit every trade is evaluated against before it reaches vault liquidity. */
  circuitId: Number(process.env.NEXT_PUBLIC_XLAYER_CIRCUIT_ID ?? 101),
  markets: ["ETH-PERP", "BTC-PERP", "SOL-PERP", "OKB-PERP"],
} as const;
