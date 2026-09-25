"use client";

import React, { useState } from "react";
import { OrderBookData } from "@/hooks/useOrderBook";
import { LiveTrade } from "@/hooks/useLiveTrades";
import { formatPrice, formatSpreadBps, formatUsd } from "@/lib/trade/math";
import { RuneIcon } from "@/components/ui/RuneIcon";
import { cn } from "@/lib/utils";

interface OrderBookPanelProps {
  orderBook: OrderBookData;
  recentTrades: LiveTrade[];
  precision?: number;
}

export function OrderBookPanel({
  orderBook,
  recentTrades,
  precision = 2,
}: OrderBookPanelProps) {
  const [activeTab, setActiveTab] = useState<"book" | "trades">("book");
  const [grouping, setGrouping] = useState<"0.1" | "0.5" | "1.0">("0.1");
  const [depthMode, setDepthMode] = useState<"both" | "bids" | "asks">("both");

  const { asks, bids, spread, spreadPercent, midPrice } = orderBook;

  const visibleAsksCount = depthMode === "both" ? 8 : depthMode === "asks" ? 16 : 0;
  const visibleBidsCount = depthMode === "both" ? 8 : depthMode === "bids" ? 16 : 0;

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-[#000000] text-foreground select-none">
      {/* ─── Flat Institutional Tab Bar (Lighter-Style) ─── */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#e2e5eb] dark:border-[#1e1e1e] px-3 bg-[#f8f9fb] dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-5 h-full">
          <button
            type="button"
            onClick={() => setActiveTab("book")}
            className={cn(
              "h-full text-xs transition-colors cursor-pointer flex items-center gap-1.5 relative",
              activeTab === "book"
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground font-bold"
                : "text-foreground-muted hover:text-foreground font-medium"
            )}
          >
            <span>Order Book</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trades")}
            className={cn(
              "h-full text-xs transition-colors cursor-pointer flex items-center gap-1.5 relative",
              activeTab === "trades"
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground font-bold"
                : "text-foreground-muted hover:text-foreground font-medium"
            )}
          >
            <span>Trades</span>
          </button>
        </div>
      </div>

      {/* ─── Secondary Sub-Toolbar: Depth Mode & Precision (Lighter standard) ─── */}
      {activeTab === "book" && (
        <div className="flex h-7 shrink-0 items-center justify-between border-b border-[#e2e5eb] dark:border-[#1e1e1e] px-3 bg-[#f0f2f6] dark:bg-[#080808]">
          {/* 3 Depth View Toggle Icons */}
          <div className="flex items-center gap-0.5 border border-[#d2d6df] dark:border-[#222222] rounded bg-[#e5e8ee] dark:bg-[#121212] p-0.5">
            <button
              type="button"
              onClick={() => setDepthMode("both")}
              title="Default (Bids and Asks)"
              className={cn(
                "p-1 rounded transition-colors cursor-pointer flex flex-col gap-0.5",
                depthMode === "both" ? "bg-surface text-foreground" : "text-foreground-muted hover:text-foreground"
              )}
            >
              <span className="h-1 w-2.5 rounded-xs bg-[#f6465d]" />
              <span className="h-1 w-2.5 rounded-xs bg-[#0ecb81]" />
            </button>
            <button
              type="button"
              onClick={() => setDepthMode("bids")}
              title="Bids Only"
              className={cn(
                "p-1 rounded transition-colors cursor-pointer flex flex-col gap-0.5",
                depthMode === "bids" ? "bg-surface text-foreground" : "text-foreground-muted hover:text-foreground"
              )}
            >
              <span className="h-1 w-2.5 rounded-xs bg-[#0ecb81]" />
              <span className="h-1 w-2.5 rounded-xs bg-[#0ecb81]" />
            </button>
            <button
              type="button"
              onClick={() => setDepthMode("asks")}
              title="Asks Only"
              className={cn(
                "p-1 rounded transition-colors cursor-pointer flex flex-col gap-0.5",
                depthMode === "asks" ? "bg-surface text-foreground" : "text-foreground-muted hover:text-foreground"
              )}
            >
              <span className="h-1 w-2.5 rounded-xs bg-[#f6465d]" />
              <span className="h-1 w-2.5 rounded-xs bg-[#f6465d]" />
            </button>
          </div>

          {/* Tick Precision */}
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="text-foreground-muted">Tick</span>
            {(["0.1", "0.5", "1.0"] as const).map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setGrouping(step)}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors cursor-pointer",
                  grouping === step
                    ? "bg-accent/15 text-accent font-bold"
                    : "text-foreground-muted hover:text-foreground"
                )}
              >
                {step}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Content Area ─── */}
      {activeTab === "book" ? (
        <div className="flex flex-1 flex-col overflow-hidden text-[11px] font-mono">
          {/* Column Header */}
          <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] text-foreground-muted uppercase tracking-wider border-b border-[#e2e5eb] dark:border-[#1e1e1e] bg-[#f8f9fb] dark:bg-[#0a0a0a]">
            <span className="text-left">Price (USD)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          {/* Asks (Sells) */}
          {visibleAsksCount > 0 && (
            <div className="flex flex-1 flex-col-reverse justify-end overflow-hidden py-0.5">
              {asks.slice(0, visibleAsksCount).map((ask, idx) => {
                const askPrice = Number(ask.price) || 0;
                const askSize = Number(ask.size) || 0;
                const askTotal = Number(ask.total) || 0;

                return (
                  <div
                    key={`ask-${idx}-${askPrice}`}
                    className="relative grid grid-cols-3 px-3 py-[2px] items-center hover:bg-[#f6465d]/10 transition-colors group cursor-pointer"
                  >
                    {/* Depth Volume Visualizer Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#f6465d]/15 transition-all duration-200 pointer-events-none"
                      style={{ width: `${ask.depthPercent}%` }}
                    />
                    <span className="relative z-10 text-[#f6465d] font-medium text-left">
                      {askPrice.toFixed(precision)}
                    </span>
                    <span className="relative z-10 text-foreground-muted text-right">
                      {askSize.toFixed(3)}
                    </span>
                    <span className="relative z-10 text-foreground text-right">
                      {askTotal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Spread & Mid Market Price Bar (Lighter Centered Format) */}
          {depthMode === "both" && (
            <div className="flex items-center justify-between border-y border-[#e2e5eb] dark:border-[#1e1e1e] bg-[#f0f2f6] dark:bg-[#080808] px-3 py-1 my-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">
                  {formatPrice(midPrice)}
                </span>
                <RuneIcon name="arrows-arrow-up" className="h-3 w-3 text-[#0ecb81]" />
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-foreground-muted">
                <span>{formatPrice(spread)}</span>
                <span className="text-accent font-semibold">
                  SPREAD {formatSpreadBps(spreadPercent)}
                </span>
              </div>
            </div>
          )}

          {/* Bids (Buys) */}
          {visibleBidsCount > 0 && (
            <div className="flex flex-1 flex-col overflow-hidden py-0.5">
              {bids.slice(0, visibleBidsCount).map((bid, idx) => {
                const bidPrice = Number(bid.price) || 0;
                const bidSize = Number(bid.size) || 0;
                const bidTotal = Number(bid.total) || 0;

                return (
                  <div
                    key={`bid-${idx}-${bidPrice}`}
                    className="relative grid grid-cols-3 px-3 py-[2px] items-center hover:bg-[#0ecb81]/10 transition-colors group cursor-pointer"
                  >
                    {/* Depth Volume Visualizer Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#0ecb81]/15 transition-all duration-200 pointer-events-none"
                      style={{ width: `${bid.depthPercent}%` }}
                    />
                    <span className="relative z-10 text-[#0ecb81] font-medium text-left">
                      {bidPrice.toFixed(precision)}
                    </span>
                    <span className="relative z-10 text-foreground-muted text-right">
                      {bidSize.toFixed(3)}
                    </span>
                    <span className="relative z-10 text-foreground text-right">
                      {bidTotal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Live Protocol Trades Stream (Lighter 3-Column Standard) */
        <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar text-[11px] font-mono">
          <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] text-foreground-muted uppercase tracking-wider border-b border-[#e2e5eb] dark:border-[#1e1e1e] bg-[#f8f9fb] dark:bg-[#0a0a0a]">
            <span className="text-left">Price (USD)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Time</span>
          </div>

          <div className="flex flex-col py-0.5">
            {recentTrades.map((t, idx) => {
              const isBuy = t.side === "long";
              const rawPrice = Number(t.exitPrice) > 0 ? Number(t.exitPrice) : Number(t.entryPrice);
              const tradePrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
              const formattedTime = t.closedAt
                ? (typeof t.closedAt === "string" && t.closedAt.includes("T")
                    ? t.closedAt.split("T")[1]?.slice(0, 8)
                    : String(t.closedAt))
                : "Recent";
              const sizeUsdNum = Number(t.sizeUsd) || 0;

              return (
                <div
                  key={t.txSignature || `trade-${idx}`}
                  className="grid grid-cols-3 px-3 py-[3px] items-center hover:bg-[#f8f9fb] dark:hover:bg-[#121212] transition-colors"
                >
                  <span
                    className={cn(
                      "font-semibold text-left",
                      isBuy ? "text-[#0ecb81]" : "text-[#f6465d]"
                    )}
                  >
                    {tradePrice > 0 ? tradePrice.toFixed(precision) : "—"}
                  </span>
                  <div className="text-right flex items-center justify-end gap-1">
                    <span className="text-foreground font-medium">
                      {sizeUsdNum > 1000 ? formatUsd(sizeUsdNum, 0, 0) : `$${sizeUsdNum.toFixed(2)}`}
                    </span>
                    {t.agentName && (
                      <span className="text-[8px] px-1 py-0.1 rounded font-bold uppercase bg-accent/10 text-accent hidden xl:inline-block truncate max-w-[55px]">
                        {typeof t.agentName === "string" ? t.agentName.split(" ")[0] : "Agent"}
                      </span>
                    )}
                  </div>
                  <span className="text-right text-foreground-muted text-[10px]">
                    {formattedTime}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderBookPanel;
