"use client";

import React from "react";
import { TradePosition } from "@/lib/trade/tradeStore";
import { formatPrice, formatUsd } from "@/lib/trade/math";
import { cn } from "@/lib/utils";

interface ChartPositionOverlayProps {
  position?: TradePosition | null;
  markPrice?: number;
  onClosePosition: (pos: TradePosition) => void;
  isSubmitting?: boolean;
}

export function ChartPositionOverlay({
  position,
  markPrice: liveMarkPrice,
  onClosePosition,
  isSubmitting = false,
}: ChartPositionOverlayProps) {
  if (!position) return null;

  const isLong = position.side === "long";
  const isProfit = position.pnlUsd >= 0;
  const assetSymbol = position.market.split("-")[0] || "ETH";
  const assetSize = (position.sizeUsd / (position.entryPrice || 1)).toFixed(4);

  const currentPrice = liveMarkPrice || position.markPrice || position.entryPrice;

  // ─── Dynamic Price Y-Coordinate Positioning ───
  // Calculate difference from current market price
  const priceDeltaPercent = currentPrice > 0
    ? ((position.entryPrice - currentPrice) / currentPrice) * 100
    : 0;

  // If the entry price is more than 6% away from current price, it is outside the visible candle chart
  const isOffScale = Math.abs(priceDeltaPercent) > 6;
  const isAboveChart = priceDeltaPercent > 6;

  // Scale: 1% delta moves ~5% of chart height; center is at 52%
  const rawTopPercent = 52 - (priceDeltaPercent * 6);
  // Safe boundaries so it NEVER overlaps the TradingView header (22%) or bottom axis (82%)
  const topPercent = Math.max(22, Math.min(80, rawTopPercent));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      {/* ─── Dotted Horizontal Entry Price Line (Only when within visible candle range) ─── */}
      {!isOffScale && (
        <>
          <div
            className="absolute left-0 right-16 flex items-center transition-all duration-300 pointer-events-none"
            style={{ top: `${topPercent}%` }}
          >
            <div
              className={cn(
                "w-full border-b border-dashed",
                isLong ? "border-[#0ecb81]/70" : "border-[#f6465d]/70"
              )}
            />
          </div>

          {/* Entry Price Tag on Right Price Axis */}
          <div
            className="absolute right-0 -translate-y-1/2 flex items-center transition-all duration-300 pointer-events-none z-10"
            style={{ top: `${topPercent}%` }}
          >
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-l text-[10px] font-mono font-bold text-white shadow-xs",
                isLong ? "bg-[#0ecb81]" : "bg-[#f6465d]"
              )}
            >
              {formatPrice(position.entryPrice)}
            </span>
          </div>
        </>
      )}

      {/* ─── Position Chip (Positioned on line when in-range, or pinned cleanly when off-chart) ─── */}
      <div
        className={cn(
          "pointer-events-auto absolute transition-all duration-300 z-20",
          isOffScale
            ? isAboveChart
              ? "top-14 left-20"
              : "bottom-14 left-20"
            : "left-24 -translate-y-1/2"
        )}
        style={!isOffScale ? { top: `${topPercent}%` } : undefined}
      >
        <div
          className="flex items-center gap-2 rounded-[3px] px-2.5 py-1 text-[11px] font-mono select-none bg-white dark:bg-[#121212] border border-[#d2d6df] dark:border-[#2a2a2a] shadow-[0_1px_4px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.7)] transition-all hover:shadow-md"
          title={`Entry: ${formatPrice(position.entryPrice)} | Mark: ${formatPrice(currentPrice)} | Liq: ${formatPrice(position.liqPrice)} | Size: ${assetSize} ${assetSymbol}`}
        >
          {/* Side & Size (e.g. "LONG 0.2413 ETH") */}
          <span
            className={cn(
              "font-bold uppercase tracking-tight",
              isLong ? "text-[#0ecb81]" : "text-[#f6465d]"
            )}
          >
            {position.side} {assetSize} {assetSymbol}
          </span>

          {/* Entry indicator */}
          <span className="text-foreground-muted">
            @{formatPrice(position.entryPrice)}
          </span>

          {/* Off-chart notice if price is far from visible candles */}
          {isOffScale && (
            <span className="text-[10px] text-accent font-semibold px-1 rounded bg-accent/10">
              {isAboveChart ? "▲ High" : "▼ Low"}
            </span>
          )}

          {/* Unrealized PnL (e.g. "-$0.17") */}
          <span
            className={cn(
              "font-bold",
              isProfit ? "text-[#0ecb81]" : "text-[#f6465d]"
            )}
          >
            {isProfit ? "+" : ""}{formatUsd(position.pnlUsd)}
          </span>

          {/* Quick Close Button ✕ */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClosePosition(position);
            }}
            disabled={isSubmitting}
            title="Close position at market price"
            className="p-0.5 rounded text-foreground-muted hover:text-[#f6465d] hover:bg-[#f6465d]/15 transition-colors cursor-pointer disabled:opacity-50 ml-1"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChartPositionOverlay;
