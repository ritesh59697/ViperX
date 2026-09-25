"use client";

import React, { useState } from "react";
import { TradePosition, useTradeStore } from "@/lib/trade/tradeStore";
import {
  formatPrice,
  formatSignedPercent,
  formatUsd,
} from "@/lib/trade/math";
import { RuneIcon } from "@/components/ui/RuneIcon";
import { cn } from "@/lib/utils";

interface PositionsTableProps {
  positions: TradePosition[];
  poolCollateralUsd?: number;
  onClosePosition: (pos: TradePosition) => void;
  onCloseAllPositions?: () => void;
  isSubmitting?: boolean;
}

export function PositionsTable({
  positions,
  poolCollateralUsd = 250000,
  onClosePosition,
  onCloseAllPositions,
  isSubmitting = false,
}: PositionsTableProps) {
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "fills" | "vault">("positions");
  const { setShareModalPosition } = useTradeStore();

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-[#000000] text-foreground select-none">
      {/* ─── Institutional Flat Tab Bar (Lighter Standard) ─── */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#e2e5eb] dark:border-[#1e1e1e] px-3 bg-[#f8f9fb] dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar h-full">
          {/* Positions Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("positions")}
            className={cn(
              "h-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 relative shrink-0",
              activeTab === "positions"
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full font-bold"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            <span>Positions</span>
            <span
              className={cn(
                "px-1.5 py-0.2 rounded text-[10px] font-mono",
                positions.length > 0
                  ? "bg-accent/20 text-accent font-bold"
                  : "bg-[#e5e8ee] dark:bg-[#141414] text-foreground-muted"
              )}
            >
              {positions.length}
            </span>
          </button>

          {/* Open Orders Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={cn(
              "h-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 relative shrink-0",
              activeTab === "orders"
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full font-bold"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            <span>Orders</span>
            <span className="bg-[#e5e8ee] dark:bg-[#141414] text-foreground-muted px-1.5 py-0.2 rounded text-[10px] font-mono">
              0
            </span>
          </button>

          {/* Trade History Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("fills")}
            className={cn(
              "h-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 relative shrink-0",
              activeTab === "fills"
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full font-bold"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            <span>Trade History</span>
          </button>

          {/* Public Pools Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("vault")}
            className={cn(
              "h-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 relative shrink-0",
              activeTab === "vault"
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full font-bold"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            <span>Public Pools (vLP)</span>
          </button>
        </div>

        {/* Far Right: Lighter-Style CLOSE ALL ✕ Button */}
        <div className="flex items-center gap-3 shrink-0 pl-2">
          {positions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (onCloseAllPositions) {
                  onCloseAllPositions();
                } else {
                  positions.forEach((p) => onClosePosition(p));
                }
              }}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#f6465d] hover:text-[#f6465d]/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>CLOSE ALL</span>
              <RuneIcon name="indicators-x" className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="flex-1 overflow-auto text-xs">
        {activeTab === "positions" && (
          positions.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center gap-2 text-foreground-muted">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f2f6] dark:bg-[#121212] border border-[#d2d6df] dark:border-[#222222]">
                <RuneIcon name="metrics-chart-bar" className="h-4 w-4 text-foreground-muted" />
              </div>
              <span className="text-xs font-semibold text-foreground">No open perpetual positions</span>
              <span className="text-[11px] font-mono text-foreground-muted/70">
                Execute a trade or delegate to the Viper AI Co-Pilot
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px] border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-[#e2e5eb] dark:border-[#1e1e1e] text-[10px] text-foreground-muted uppercase tracking-wider bg-[#f8f9fb] dark:bg-[#0a0a0a]">
                    <th className="py-2 px-3 font-semibold">Market</th>
                    <th className="py-2 px-3 text-right font-semibold">Size</th>
                    <th className="py-2 px-3 text-right font-semibold">Value</th>
                    <th className="py-2 px-3 text-right font-semibold">Entry Price</th>
                    <th className="py-2 px-3 text-right font-semibold">Mark Price</th>
                    <th className="py-2 px-3 text-right font-semibold">Liq. Price</th>
                    <th className="py-2 px-3 text-right font-semibold">Unrealized PnL</th>
                    <th className="py-2 px-3 text-right font-semibold">Margin</th>
                    <th className="py-2 px-3 text-right font-semibold">Funding</th>
                    <th className="py-2 px-3 text-center font-semibold">TP / SL</th>
                    <th className="py-2 px-3 text-center font-semibold sticky right-0 bg-[#f8f9fb] dark:bg-[#0a0a0a] z-10 shadow-[-6px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[-6px_0_10px_rgba(0,0,0,0.4)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f4] dark:divide-[#161616]">
                  {positions.map((pos) => {
                    const isLong = pos.side === "long";
                    const isProfit = pos.pnlUsd >= 0;
                    const assetSymbol = pos.market.split("-")[0] || "ETH";
                    const assetSize = (pos.sizeUsd / (pos.entryPrice || 1)).toFixed(4);

                    return (
                      <tr
                        key={pos.id}
                        className="hover:bg-[#f8f9fb] dark:hover:bg-[#121212] transition-colors h-9"
                      >
                        {/* Market + Leverage Badge */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground">{assetSymbol}</span>
                            <span
                              className={cn(
                                "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase",
                                isLong
                                  ? "bg-[#0ecb81]/15 text-[#0ecb81]"
                                  : "bg-[#f6465d]/15 text-[#f6465d]"
                              )}
                            >
                              {pos.leverage}x
                            </span>
                          </div>
                        </td>

                        {/* Size in Asset Units (ETH) */}
                        <td className="py-2 px-3 text-right">
                          <span
                            className={cn(
                              "font-bold",
                              isLong ? "text-[#0ecb81]" : "text-[#f6465d]"
                            )}
                          >
                            {isLong ? "+" : "-"}{assetSize} {assetSymbol}
                          </span>
                        </td>

                        {/* Value in USD */}
                        <td className="py-2 px-3 text-right font-medium text-foreground">
                          {formatUsd(pos.sizeUsd)}
                        </td>

                        {/* Entry Price */}
                        <td className="py-2 px-3 text-right text-foreground-muted">
                          {formatPrice(pos.entryPrice)}
                        </td>

                        {/* Mark Price */}
                        <td className="py-2 px-3 text-right font-semibold text-foreground">
                          {formatPrice(pos.markPrice)}
                        </td>

                        {/* Liq Price */}
                        <td className="py-2 px-3 text-right font-medium text-[#f6465d]">
                          {pos.liqPrice > 0 ? formatPrice(pos.liqPrice) : "N/A"}
                        </td>

                        {/* Unrealized PnL (Single line + Share button) */}
                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 font-bold">
                            <span className={isProfit ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                              {isProfit ? "+" : ""}{formatUsd(pos.pnlUsd)} ({formatSignedPercent(pos.pnlPercent)})
                            </span>
                            <button
                              type="button"
                              onClick={() => setShareModalPosition(pos)}
                              title="Share PnL card"
                              className="text-foreground-muted hover:text-accent transition-colors cursor-pointer p-0.5"
                            >
                              <RuneIcon name="actions-share-2" className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {/* Margin */}
                        <td className="py-2 px-3 text-right text-foreground-muted font-medium">
                          {formatUsd(pos.collateralUsd)}
                        </td>

                        {/* Funding Accrued */}
                        <td className="py-2 px-3 text-right text-foreground-muted">
                          $0.00
                        </td>

                        {/* TP / SL */}
                        <td className="py-2 px-3 text-center text-foreground-muted">
                          <span className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer">
                            <span>_ / _</span>
                            <RuneIcon name="tools-pencil" className="h-2.5 w-2.5 opacity-60" />
                          </span>
                        </td>

                        {/* Close Action (Market Close Button) */}
                        <td className="py-2 px-3 text-center sticky right-0 bg-white dark:bg-[#000000] z-10 shadow-[-6px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[-6px_0_10px_rgba(0,0,0,0.4)]">
                          <button
                            type="button"
                            onClick={() => onClosePosition(pos)}
                            disabled={isSubmitting}
                            title="Close position at market price"
                            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-[4px] border border-[#d2d6df] dark:border-[#262626] bg-[#f8f9fb] hover:bg-[#f6465d]/10 dark:bg-[#121212] dark:hover:bg-[#f6465d]/20 text-foreground-muted hover:text-[#f6465d] hover:border-[#f6465d]/40 text-[11px] font-mono font-medium transition-all cursor-pointer disabled:opacity-50"
                          >
                            <span>Market</span>
                            <svg
                              className="h-2.5 w-2.5 opacity-70"
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Open Orders Tab Empty State */}
        {activeTab === "orders" && (
          <div className="flex h-44 flex-col items-center justify-center gap-2 text-foreground-muted">
            <span className="text-xs font-semibold text-foreground">No open limit orders</span>
            <span className="text-[11px] font-mono text-foreground-muted/70">
              Orders placed with Limit mode will be tracked here.
            </span>
          </div>
        )}

        {/* Trade History & Cryptographic Proof Receipts Tab */}
        {activeTab === "fills" && (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left font-mono text-[11px] border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-[#e2e5eb] dark:border-[#1e1e1e] text-[10px] text-foreground-muted uppercase tracking-wider bg-[#f8f9fb] dark:bg-[#0a0a0a]">
                  <th className="py-2 px-3 font-semibold">Execution Market</th>
                  <th className="py-2 px-3 text-right font-semibold">Position Size</th>
                  <th className="py-2 px-3 text-right font-semibold">Entry / Fill</th>
                  <th className="py-2 px-3 text-right font-semibold">Oracle Source</th>
                  <th className="py-2 px-3 text-center font-semibold">Verification Proof</th>
                  <th className="py-2 px-3 text-center font-semibold">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f4] dark:divide-[#161616]">
                {positions.map((p) => {
                  const explorerUrl =
                    p.chain === "xlayer"
                      ? `https://www.oklink.com/xlayer-test/tx/${p.txHash}`
                      : p.chain === "base"
                      ? `https://sepolia.basescan.org/tx/${p.txHash}`
                      : `https://explorer.solana.com/tx/${p.txHash}?cluster=devnet`;
                  const shortTx = p.txHash
                    ? `${p.txHash.slice(0, 6)}...${p.txHash.slice(-4)}`
                    : "0xddd7...cb66";

                  return (
                    <tr key={`fill-${p.id}`} className="hover:bg-[#f8f9fb] dark:hover:bg-[#121212] transition-colors h-9">
                      <td className="py-2 px-3 font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{p.market}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-[#e5e8ee] dark:bg-[#141414] text-foreground-muted">
                            {p.side} {p.leverage}x
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right text-foreground font-medium">
                        {formatUsd(p.sizeUsd)}
                      </td>
                      <td className="py-2 px-3 text-right text-foreground-muted">
                        {formatPrice(p.entryPrice)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-[10px] text-accent font-semibold flex items-center justify-end gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                          <span>Pyth Oracle</span>
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline font-mono text-[10px]"
                        >
                          <span>{shortTx}</span>
                          <RuneIcon name="indicators-square-arrow-out-up-right" className="h-2.5 w-2.5" />
                        </a>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setShareModalPosition(p)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-[#edf0f5] dark:bg-[#121212] hover:dark:bg-[#1a1a1a] border border-[#d2d6df] dark:border-[#222222] text-[10px] text-foreground font-semibold cursor-pointer"
                        >
                          <RuneIcon name="actions-share-2" className="h-2.5 w-2.5 text-accent" />
                          <span>View Proof</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Public Pools Tab */}
        {activeTab === "vault" && (
          <div className="p-4 font-mono text-[11px] text-foreground-muted flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-foreground">Viper Liquidity Pool (vLP)</div>
              <div>Decentralized counterparty pool backing all Base Sepolia perps.</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-accent">${poolCollateralUsd.toLocaleString()} USDC</div>
              <div className="text-[10px] text-positive">100% Solvency Ratio</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
