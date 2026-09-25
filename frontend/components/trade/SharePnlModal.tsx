"use client";

import React, { useState, useRef } from "react";
import { TradePosition, useTradeStore } from "@/lib/trade/tradeStore";
import { formatPrice, formatSignedPercent, formatUsd } from "@/lib/trade/math";
import { RuneIcon } from "@/components/ui/RuneIcon";
import { cn } from "@/lib/utils";

interface SharePnlModalProps {
  position: TradePosition | null;
  onClose: () => void;
}

export function SharePnlModal({ position, onClose }: SharePnlModalProps) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!position) return null;

  const isProfit = position.pnlPercent >= 0;
  const isXLayer = position.chain === "xlayer";
  const isBase = position.chain === "base";

  const chainLabel = isXLayer
    ? "X Layer"
    : isBase
    ? "Base Sepolia"
    : "Solana Devnet";

  const explorerUrl = isXLayer
    ? position.txHash?.startsWith("0x") && position.txHash.length === 66
      ? `https://www.oklink.com/xlayer-test/tx/${position.txHash}`
      : `https://www.oklink.com/xlayer-test/address/${position.txHash || "0x9Dcfe752AC97F167763FeD87f4100F33cD29dbb7"}`
    : isBase
    ? `https://sepolia.basescan.org/tx/${position.txHash}`
    : `https://explorer.solana.com/tx/${position.txHash}?cluster=devnet`;

  const shortTx = position.txHash
    ? `${position.txHash.slice(0, 6)}...${position.txHash.slice(-4)}`
    : "Verified";

  const tweetText = encodeURIComponent(
    `Verified PnL: ${formatSignedPercent(position.pnlPercent)} (${formatUsd(position.pnlUsd)}) on ${position.market} via @ViperX_site on ${chainLabel}\n\nProof: ${explorerUrl}`
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `ViperX Proof Receipt\nMarket: ${position.market} (${position.side.toUpperCase()} ${position.leverage}x)\nPnL: ${formatSignedPercent(position.pnlPercent)} (${formatUsd(position.pnlUsd)})\nNetwork: ${chainLabel}\nProof: ${explorerUrl}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-200 select-none">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background-elevated-solid shadow-2xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">Cryptographic Proof Receipt</span>
            <span className="text-[10px] font-mono bg-positive/10 text-positive px-2 py-0.5 rounded-full font-bold border border-positive/30 flex items-center gap-1">
              <RuneIcon name="indicators-circle-check" className="h-3 w-3" />
              <span>On-Chain</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-foreground-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <RuneIcon name="indicators-x" className="h-4 w-4" />
          </button>
        </div>

        {/* ─── The Visual Share Card (Cryptographic Receipt) ─── */}
        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-[#0e1219] to-[#06080b] p-6 text-white shadow-2xl flex flex-col justify-between min-h-[320px]"
        >
          {/* Subtle Grid Background & Ambient Lighting */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(208,32,10,0.15),transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Top Brand & Network */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/viperx-logo-option-1-exact-logo.png"
                alt="ViperX Logo"
                className="h-7 w-7 object-contain drop-shadow"
              />
              <span className="font-bold text-base tracking-tight text-white leading-none">
                Viper<span className="text-accent">X</span>
              </span>
            </div>

            <span className="px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/10 font-mono text-[11px] font-medium text-gray-300">
              {chainLabel}
            </span>
          </div>

          {/* Main Return on Investment (PnL) */}
          <div className="relative z-10 my-4 flex flex-col items-center text-center">
            <span className="text-[10px] font-mono uppercase text-gray-400 tracking-wider mb-1">
              Settled PnL
            </span>
            <div
              className={cn(
                "text-5xl sm:text-6xl font-black font-mono tracking-tight transition-all",
                isProfit ? "text-emerald-400 drop-shadow-[0_0_25px_rgba(52,211,153,0.3)]" : "text-rose-500 drop-shadow-[0_0_25px_rgba(244,63,94,0.3)]"
              )}
            >
              {formatSignedPercent(position.pnlPercent)}
            </div>
            <span
              className={cn(
                "mt-1 font-mono text-sm font-semibold",
                isProfit ? "text-emerald-400/90" : "text-rose-400/90"
              )}
            >
              {isProfit ? "+" : ""}{formatUsd(position.pnlUsd)}
            </span>
          </div>

          {/* Market & Strategy Metadata Footer */}
          <div className="relative z-10 rounded-xl bg-white/[0.04] border border-white/10 p-3 grid grid-cols-2 gap-2.5 text-left font-mono text-[11px]">
            <div>
              <span className="text-gray-400 text-[9px] uppercase tracking-wider">Market</span>
              <div className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                <span>{position.market}</span>
                <span
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                    position.side === "long" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                  )}
                >
                  {position.side} {position.leverage}x
                </span>
              </div>
            </div>

            <div>
              <span className="text-gray-400 text-[9px] uppercase tracking-wider">Strategy</span>
              <div className="font-medium text-gray-300 mt-0.5 truncate">
                {position.agentName?.startsWith("Connected Wallet")
                  ? "Manual"
                  : position.agentName || "Manual"}
              </div>
            </div>

            <div>
              <span className="text-gray-400 text-[9px] uppercase tracking-wider">Entry Price</span>
              <div className="font-medium text-gray-200 mt-0.5">
                {formatPrice(position.entryPrice)}
              </div>
            </div>

            <div>
              <span className="text-gray-400 text-[9px] uppercase tracking-wider">Mark Price</span>
              <div className="font-medium text-gray-200 mt-0.5">
                {formatPrice(position.markPrice)}
              </div>
            </div>

            {/* Immutable Explorer Hash Link */}
            <div className="col-span-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
              <span className="text-gray-400">Proof:</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline flex items-center gap-1 font-mono font-medium"
              >
                <span>{shortTx}</span>
                <RuneIcon name="indicators-square-arrow-out-up-right" className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 px-3 rounded-xl bg-surface hover:bg-surface-hover border border-border text-foreground font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <RuneIcon
                name={copied ? "indicators-check" : "code-copy"}
                className={cn("h-4 w-4", copied && "text-positive")}
              />
              <span>{copied ? "Proof Copied!" : "Copy Proof Receipt"}</span>
            </button>

            <a
              href={`https://twitter.com/intent/tweet?text=${tweetText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-accent hover:brightness-110 text-white font-bold text-xs transition-all shadow-md shadow-accent/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Share Proof on X</span>
              <RuneIcon name="indicators-square-arrow-out-up-right" className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  export default SharePnlModal;
