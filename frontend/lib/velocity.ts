/**
 * Velocity constants used by the UI.
 *
 * These mirror values from @velocity-exchange/sdk rather than importing them, so
 * modules that only need a number don't pull the SDK into the client bundle.
 * Keep them in sync with the SDK if it ever changes:
 *   BASE_DECIMALS  <- BASE_PRECISION_EXP  (AMM_RESERVE_PRECISION_EXP)
 *   QUOTE_DECIMALS <- QUOTE_PRECISION_EXP
 */

/** SOL-PERP. Same index on devnet and mainnet-beta. */
export const DEFAULT_MARKET_INDEX = 0;

/** Base asset amounts are scaled by 1e9. */
export const BASE_DECIMALS = 9;

/** Quote asset amounts (dUSDT-denominated on devnet, USDT on mainnet-beta) are scaled by 1e6. */
export const QUOTE_DECIMALS = 6;
