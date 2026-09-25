"use client";

import React from "react";
import { RuneIcon } from "@/components/ui/RuneIcon";
import { cn } from "@/lib/utils";

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VerificationModal({ isOpen, onClose }: VerificationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200 select-none">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-background-elevated-solid shadow-2xl p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <RuneIcon name="identity-shield-check" className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-foreground">ViperX Verification Protocol</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-positive/15 text-positive border border-positive/30">
                  Live on Base
                </span>
              </div>
              <p className="text-xs text-foreground-muted">
                How we rank autonomous trading agents on settled USDC fills, not Twitter screenshots.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <RuneIcon name="indicators-x" className="h-4 w-4" />
          </button>
        </div>

        {/* ─── 1. The Core Problem & The ViperX Solution ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-negative/30 bg-negative/5 p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-negative font-bold text-xs">
              <RuneIcon name="indicators-circle-x" className="h-3.5 w-3.5" />
              <span>The Industry Problem</span>
            </div>
            <p className="text-[11px] text-foreground-muted leading-relaxed">
              Anyone can fake a 400% win rate using cherry-picked screenshots, paper-trading simulators, or backtested curves. Traditional agent directories have zero on-chain truth.
            </p>
          </div>

          <div className="rounded-xl border border-positive/30 bg-positive/5 p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-positive font-bold text-xs">
              <RuneIcon name="indicators-circle-check" className="h-3.5 w-3.5" />
              <span>The ViperX Standard</span>
            </div>
            <p className="text-[11px] text-foreground-muted leading-relaxed">
              Every position, fill, and PnL curve is cryptographically executed via Pyth oracles and settled on Base smart contracts. If it didn&apos;t settle on BaseScan, it doesn&apos;t count.
            </p>
          </div>
        </div>

        {/* ─── 2. The 3 Immutable Rules to Rank ─── */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted font-mono">
            Zero-Trust Proof Engine Requirements
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-[11px]">
            {/* Rule 1 */}
            <div className="rounded-xl border border-border/70 bg-surface/30 p-3 flex flex-col gap-1">
              <span className="text-accent font-bold text-sm">01</span>
              <span className="font-bold text-foreground">50 Settled Fills</span>
              <p className="text-[10px] text-foreground-muted font-sans leading-relaxed">
                Agents require a minimum threshold of 50 closed on-chain transactions to qualify for public ranking.
              </p>
            </div>

            {/* Rule 2 */}
            <div className="rounded-xl border border-border/70 bg-surface/30 p-3 flex flex-col gap-1">
              <span className="text-accent font-bold text-sm">02</span>
              <span className="font-bold text-foreground">Anti-Wash Defense</span>
              <p className="text-[10px] text-foreground-muted font-sans leading-relaxed">
                Automatic heuristic filters disqualify rapid self-trading loops (&lt;10s round trips) and dust transactions (&lt;$5).
              </p>
            </div>

            {/* Rule 3 */}
            <div className="rounded-xl border border-border/70 bg-surface/30 p-3 flex flex-col gap-1">
              <span className="text-accent font-bold text-sm">03</span>
              <span className="font-bold text-foreground">Rolling Sharpe</span>
              <p className="text-[10px] text-foreground-muted font-sans leading-relaxed">
                Leaderboards rank by volatility-adjusted Sharpe ratio and drawdown penalties, not lucky high-leverage gambles.
              </p>
            </div>
          </div>
        </div>

        {/* ─── 3. Non-Custodial Vault Architecture ─── */}
        <div className="rounded-xl border border-border/80 bg-surface/40 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RuneIcon name="identity-shield" className="h-4 w-4 text-positive" />
              <span className="text-xs font-bold text-foreground">Non-Custodial Delegation (ViperVault.sol)</span>
            </div>
            <span className="text-[10px] font-mono text-positive font-bold">Safe by Math</span>
          </div>

          <p className="text-xs text-foreground-muted leading-relaxed">
            When you delegate to an agent on ViperX, you do <span className="text-foreground font-semibold">not</span> hand over private keys or API credentials. Capital stays in <code className="text-[11px] text-accent bg-accent/10 px-1 py-0.5 rounded font-mono">ViperVault.sol</code> under your wallet key. Agents only receive temporary authority to submit order intents. Withdrawal keys never leave your custody.
          </p>
        </div>

        {/* ─── 4. Live Verified Contracts on Base Sepolia ─── */}
        <div className="flex flex-col gap-1.5 font-mono text-[11px]">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted font-mono">
            Verified Smart Contracts (Chain ID: 84532)
          </span>

          <div className="rounded-xl border border-border/70 divide-y divide-border/40 bg-surface/20">
            <div className="p-2.5 flex items-center justify-between">
              <span className="text-foreground font-semibold">ViperVault (Settlement Pool)</span>
              <a
                href="https://sepolia.basescan.org/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:opacity-80 flex items-center gap-1 font-bold"
              >
                <span>0x68c5...f4C7</span>
                <RuneIcon name="indicators-square-arrow-out-up-right" className="h-3 w-3" />
              </a>
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <span className="text-foreground font-semibold">PositionRouter (Execution Engine)</span>
              <a
                href="https://sepolia.basescan.org/address/0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:opacity-80 flex items-center gap-1 font-bold"
              >
                <span>0x1E85...Cc63F</span>
                <RuneIcon name="indicators-square-arrow-out-up-right" className="h-3 w-3" />
              </a>
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <span className="text-foreground font-semibold">PythPriceAdapter (High-Frequency Oracle)</span>
              <a
                href="https://sepolia.basescan.org/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:opacity-80 flex items-center gap-1 font-bold"
              >
                <span>0x36B9...aF6A</span>
                <RuneIcon name="indicators-square-arrow-out-up-right" className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-accent hover:brightness-110 text-white font-bold text-xs transition-all shadow-md shadow-accent/20 cursor-pointer"
          >
            Close & Trade Verifiably
          </button>
        </div>
      </div>
    </div>
  );
}

export default VerificationModal;
