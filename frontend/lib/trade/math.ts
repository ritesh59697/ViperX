/**
 * ViperX Trading Math & Conversion Utilities
 * Pure functions for PnL, margin, liquidation price, and decimal precision.
 * Inspired by headless exchange math pipelines.
 */

export type PositionSide = "long" | "short";

/**
 * Calculates unrealized PnL in USD.
 * Long PnL = sizeUsd * ((markPrice - entryPrice) / entryPrice)
 * Short PnL = sizeUsd * ((entryPrice - markPrice) / entryPrice)
 */
export function calcUnrealizedPnl(
  side: PositionSide,
  sizeUsd: number,
  entryPrice: number,
  markPrice: number
): number {
  if (entryPrice <= 0 || sizeUsd <= 0 || markPrice <= 0) return 0;
  const priceDelta = side === "long" ? markPrice - entryPrice : entryPrice - markPrice;
  return (sizeUsd * priceDelta) / entryPrice;
}

/**
 * Calculates Return on Investment / PnL percentage against collateral.
 */
export function calcPnlPercentage(
  unrealizedPnl: number,
  collateralUsd: number
): number {
  if (collateralUsd <= 0) return 0;
  return (unrealizedPnl / collateralUsd) * 100;
}

/**
 * Calculates estimated liquidation price based on leverage and maintenance margin ratio.
 * Default maintenance margin is 5% (0.05).
 */
export function calcLiquidationPrice(
  side: PositionSide,
  entryPrice: number,
  leverage: number,
  maintenanceMarginRatio: number = 0.05
): number {
  if (entryPrice <= 0 || leverage <= 0) return 0;

  if (side === "long") {
    const liq = entryPrice * (1 - 1 / leverage + maintenanceMarginRatio);
    return Math.max(0, liq);
  } else {
    const liq = entryPrice * (1 + 1 / leverage - maintenanceMarginRatio);
    return Math.max(0, liq);
  }
}

/**
 * Calculates position size in USD from collateral and leverage.
 */
export function calcPositionSize(collateralUsd: number, leverage: number): number {
  if (collateralUsd <= 0 || leverage <= 0) return 0;
  return collateralUsd * leverage;
}

/**
 * Calculates protocol trading fee in USD (default 10 bps / 0.1%).
 */
export function calcTradingFee(sizeUsd: number, feeRatio: number = 0.001): number {
  return sizeUsd * feeRatio;
}

/**
 * Formats USD currency values with proper commas and decimal precision.
 */
export function formatUsd(val: number, minDecimals = 2, maxDecimals = 2): string {
  if (isNaN(val)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(val);
}

/**
 * Formats price numbers based on scale (e.g. BTC vs SOL).
 */
export function formatPrice(price: number): string {
  if (isNaN(price) || price <= 0) return "$0.00";
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 1) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
  }
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

/**
 * Formats signed percentage values (+4.52% / -2.10%).
 */
export function formatSignedPercent(pct: number): string {
  if (isNaN(pct)) return "0.00%";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Converts human float amount to integer token units (e.g., USDC 6 decimals, ETH 18 decimals).
 */
export function toRawUnits(amount: number, decimals: number): bigint {
  const factor = Math.pow(10, decimals);
  return BigInt(Math.round(amount * factor));
}

/**
 * Converts integer token units to human float amount.
 */
export function fromRawUnits(raw: bigint | string | number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Number(raw) / factor;
}

/**
 * Calculates projected PnL in USD from target price (for TP / SL).
 */
export function calcProjectedPnl(
  side: PositionSide,
  sizeUsd: number,
  entryPrice: number,
  targetPrice: number
): { pnlUsd: number; pnlPercent: number } {
  if (entryPrice <= 0 || sizeUsd <= 0 || targetPrice <= 0) {
    return { pnlUsd: 0, pnlPercent: 0 };
  }
  const delta = side === "long" ? targetPrice - entryPrice : entryPrice - targetPrice;
  const pnlUsd = (sizeUsd * delta) / entryPrice;
  const pnlPercent = (delta / entryPrice) * 100;
  return { pnlUsd, pnlPercent };
}

/**
 * Calculates distance from liquidation price in percentage (higher is safer).
 */
export function calcLiquidationDistance(
  side: PositionSide,
  markPrice: number,
  liqPrice: number
): number {
  if (markPrice <= 0 || liqPrice <= 0) return 100;
  if (side === "long") {
    if (markPrice <= liqPrice) return 0;
    return Math.max(0, ((markPrice - liqPrice) / markPrice) * 100);
  } else {
    if (markPrice >= liqPrice) return 0;
    return Math.max(0, ((liqPrice - markPrice) / markPrice) * 100);
  }
}

/**
 * Formats spread in basis points (1 bps = 0.01%).
 */
export function formatSpreadBps(spreadPercent: number): string {
  if (isNaN(spreadPercent)) return "0.0 bps";
  const bps = spreadPercent * 100;
  return `${bps.toFixed(1)} bps`;
}
