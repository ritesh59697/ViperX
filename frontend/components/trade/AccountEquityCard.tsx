"use client";

import React, { useState } from "react";
import { TradePosition, useTradeStore } from "@/lib/trade/tradeStore";
import { formatUsd, formatSignedPercent } from "@/lib/trade/math";
import { RuneIcon } from "@/components/ui/RuneIcon";
import { cn } from "@/lib/utils";

interface AccountEquityCardProps {
  availableUsdcBalance: number;
  positions: TradePosition[];
  isWalletConnected: boolean;
}

export function AccountEquityCard({
  availableUsdcBalance,
  positions,
  isWalletConnected,
}: AccountEquityCardProps) {
  const [faucetModalOpen, setFaucetModalOpen] = useState(false);

  // Aggregated margin metrics
  const totalCollateral = positions.reduce((acc, p) => acc + p.collateralUsd, 0);
  const totalNotional = positions.reduce((acc, p) => acc + p.sizeUsd, 0);
  const totalUnrealizedPnl = positions.reduce((acc, p) => acc + p.pnlUsd, 0);

  const perpetuaIsEquity = totalCollateral + totalUnrealizedPnl;
  const tradingEquity = isWalletConnected
    ? availableUsdcBalance + perpetuaIsEquity
    : 0;
  const spotEquity = isWalletConnected ? availableUsdcBalance : 0;
  const maintenanceMargin = totalNotional * 0.05; // 5% maintenance margin
  const marginUsage =
    tradingEquity > 0
      ? Math.min(100, (totalCollateral / tradingEquity) * 100).toFixed(1)
      : "0.0";
  const effectiveLeverage =
    tradingEquity > 0 && totalNotional > 0
      ? (totalNotional / tradingEquity).toFixed(1) + "x"
      : "0x";

  const isProfit = totalUnrealizedPnl >= 0;

  const { selectedChain } = useTradeStore();
  const explorerUrl =
    selectedChain === "xlayer"
      ? "https://www.oklink.com/xlayer-test/address/0x9Dcfe752AC97F167763FeD87f4100F33cD29dbb7"
      : selectedChain === "solana"
      ? "https://explorer.solana.com/?cluster=devnet"
      : "https://sepolia.basescan.org/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7";
  const explorerName =
    selectedChain === "xlayer" ? "OKLink" : selectedChain === "solana" ? "Explorer" : "BaseScan";

  return (
    <div className="flex flex-col border-t border-[#e2e5eb] dark:border-[#1e1e1e] bg-[#f8f9fb] dark:bg-[#080808] p-3 text-[11px] font-mono select-none">
      {/* ─── Top Deposit / Transfer Action Buttons ─── */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => window.open(selectedChain === "xlayer" ? "https://www.okx.com/xlayer" : "https://faucet.circle.com/", "_blank")}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white hover:bg-[#edf0f5] dark:bg-[#121212] hover:dark:bg-[#1a1a1a] border border-[#d2d6df] dark:border-[#222222] text-foreground font-semibold text-xs transition-colors cursor-pointer shadow-xs dark:shadow-none"
        >
          <RuneIcon name="actions-plus" className="h-3 w-3 text-accent" />
          <span>Deposit USDC</span>
        </button>
        <button
          type="button"
          onClick={() => window.open(explorerUrl, "_blank")}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white hover:bg-[#edf0f5] dark:bg-[#121212] hover:dark:bg-[#1a1a1a] border border-[#d2d6df] dark:border-[#222222] text-foreground-muted hover:text-foreground font-semibold text-xs transition-colors cursor-pointer shadow-xs dark:shadow-none"
        >
          <RuneIcon name="indicators-square-arrow-out-up-right" className="h-3 w-3" />
          <span>{explorerName}</span>
        </button>
      </div>

      {/* ─── Institutional Equity Metrics Table (Lighter Format) ─── */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-foreground-muted">
          <span>Trading Equity</span>
          <span className="font-bold text-foreground">
            {formatUsd(tradingEquity)}
          </span>
        </div>

        <div className="flex justify-between items-center text-foreground-muted">
          <span>Perpetuals Equity</span>
          <span className="font-medium text-foreground">
            {formatUsd(perpetuaIsEquity)}
          </span>
        </div>

        <div className="flex justify-between items-center text-foreground-muted">
          <span>Spot Equity</span>
          <span className="font-medium text-foreground">
            {formatUsd(spotEquity)}
          </span>
        </div>

        <div className="flex justify-between items-center text-foreground-muted pt-1 border-t border-[#e2e5eb] dark:border-[#1e1e1e]">
          <span>Portfolio Margin</span>
          <span className="font-medium text-foreground">
            {formatUsd(totalCollateral)}
          </span>
        </div>

        <div className="flex justify-between items-center text-foreground-muted">
          <span>Unrealized PnL</span>
          <span
            className={cn(
              "font-bold",
              positions.length === 0
                ? "text-foreground-muted"
                : isProfit
                ? "text-[#0ecb81]"
                : "text-[#f6465d]"
            )}
          >
            {positions.length > 0 ? (
              <>
                {isProfit ? "+" : ""}
                {formatUsd(totalUnrealizedPnl)}
              </>
            ) : (
              "$0.00"
            )}
          </span>
        </div>

        <div className="flex justify-between items-center text-foreground-muted">
          <span>Cross Leverage</span>
          <span className="font-medium text-foreground">
            {effectiveLeverage}
          </span>
        </div>

        <div className="flex justify-between items-center text-foreground-muted">
          <span>Maintenance Margin</span>
          <span className="font-medium text-foreground">
            {formatUsd(maintenanceMargin)}
          </span>
        </div>

        <div className="flex justify-between items-center text-foreground-muted">
          <span>Margin Usage</span>
          <span
            className={cn(
              "font-bold",
              parseFloat(marginUsage) > 80
                ? "text-[#f6465d]"
                : parseFloat(marginUsage) > 50
                ? "text-amber-500"
                : "text-foreground"
            )}
          >
            {marginUsage}%
          </span>
        </div>
      </div>
    </div>
  );
}
