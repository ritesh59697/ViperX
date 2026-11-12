/**
 * The market symbols registered on the live ViperVault, in the order the deploy
 * script adds them (see `contracts/script/DeployVaultWithCircuitXLayer.s.sol`).
 *
 * This lives apart from `tradeStore.ts` on purpose. `tradeStore.ts` owns the full
 * `PerpMarket` descriptors (oracle feed ids, TradingView symbols, display precision)
 * and pulls in zustand to do it; `lib/xlayer.ts` is imported by server-side API
 * routes and is deliberately dependency-free, so it cannot import that store just to
 * read eight strings. Both import this instead, which keeps one list rather than two
 * that drift — the MCP and A2A endpoints previously advertised only the four crypto
 * perps while the vault had eight markets live, making the RWA perps undiscoverable
 * to external agents.
 *
 * Adding a market: register it on chain, add it here, then add its full descriptor to
 * `SUPPORTED_MARKETS` in `tradeStore.ts`. That module throws at load if a symbol here
 * has no descriptor, and `PerpMarket.symbol` is typed to this list, so the two cannot
 * drift apart in either direction.
 */
export const XLAYER_MARKET_SYMBOLS = [
  // Crypto perpetuals
  "ETH-PERP",
  "BTC-PERP",
  "SOL-PERP",
  "OKB-PERP",
  // Tokenized equity / RWA perpetuals (Pyth-powered)
  "NVDA-PERP",
  "TSLA-PERP",
  "COIN-PERP",
  "SPY-PERP",
] as const;

export type XLayerMarketSymbol = (typeof XLAYER_MARKET_SYMBOLS)[number];
