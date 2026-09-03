"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fetchRecentTrades, type RecentTrade } from "@/lib/leaderboardApi";
import { CheckGlyph } from "@/components/ui/StatusGlyphs";

/**
 * Recent real closed trades. 0x hashes open BaseScan; others open Solana explorer.
 *
 * This component displays the live feed of verified closed trades.
 * It is initialized with trades from the server, and polls the leaderboard-api
 * every 5 seconds for any new trades, prepending them with smooth animations.
 */
export function LiveOrderStream({ trades: initialTrades }: { trades: RecentTrade[] }) {
  const [trades, setTrades] = useState<RecentTrade[]>(initialTrades);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const latest = await fetchRecentTrades(8);
        if (latest && latest.length > 0) {
          setTrades((prev) => {
            const existingSigs = new Set(prev.map((t) => t.txSignature));
            const newTrades = latest.filter((t) => !existingSigs.has(t.txSignature));
            if (newTrades.length === 0) return prev;

            const combined = [...newTrades, ...prev];
            combined.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
            return combined.slice(0, 8);
          });
        }
      } catch (error) {
        console.error("Failed to poll recent trades:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bp-panel w-full rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
          </span>
          <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-foreground">
            Recent fills / Base Sepolia
          </span>
        </div>
        <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-foreground-faint">
          On-chain verified
        </span>
      </div>

      <div className="flex flex-col font-mono text-xs">
        {trades.length === 0 && (
          <div className="flex h-24 items-center justify-center px-4 text-center text-foreground-muted">
            No settled fills yet.
          </div>
        )}

        <AnimatePresence initial={false}>
          {trades.map((t) => {
            const side = t.side.toUpperCase();
            const isLong = side === "LONG";
            const price = t.exitPrice ?? t.entryPrice;
            const isEvm = t.txSignature.startsWith("0x");
            const explorerUrl = isEvm
              ? `https://sepolia.basescan.org/tx/${t.txSignature}`
              : `https://explorer.solana.com/tx/${t.txSignature}?cluster=devnet`;

            return (
              <motion.a
                key={t.txSignature}
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8, height: 0, padding: 0, border: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-between border-b border-border/50 py-3 px-1 transition-colors hover:bg-surface/50 gap-3"
              >
                {/* Left: Side Badge + Agent Name + Market Pair + Chain Pill */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] shrink-0 rounded ${
                      isLong
                        ? "bg-positive/10 text-positive border border-positive/30"
                        : "bg-negative/10 text-negative border border-negative/30"
                    }`}
                  >
                    {side}
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
                    <span className="font-semibold text-foreground truncate text-xs sm:text-sm">
                      {t.agentName}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
                      <span>{t.marketSymbol}</span>
                      <span className={`px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-wider rounded font-medium ${
                        isEvm 
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30" 
                          : "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                      }`}>
                        {isEvm ? "Base" : "Solana"}
                      </span>
                      {t.onchainVerified && (
                        <span
                          title="Realized PnL independently confirmed against on-chain position state"
                          className="inline-flex text-positive shrink-0"
                        >
                          <CheckGlyph className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Bold Price + Size & Time */}
                <div className="flex flex-col items-end shrink-0 text-right font-mono">
                  <span className="font-bold text-foreground text-xs sm:text-sm">
                    ${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
                    <span>${Number(t.sizeUsd).toFixed(0)} USD</span>
                    <span className="text-foreground-faint">·</span>
                    <span className="text-foreground-faint">
                      {new Date(t.closedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </div>
              </motion.a>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
