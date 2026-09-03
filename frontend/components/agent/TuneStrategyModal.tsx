"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAccount, useSignMessage } from "wagmi";
import bs58 from "bs58";
import { Button } from "@/components/ui/Button";
import { CheckGlyph, XGlyph } from "@/components/ui/StatusGlyphs";
import {
  fetchStrategyParams,
  setStrategyParams,
  StrategyParams,
  tuneAgentMessage,
} from "@/lib/leaderboardApi";

interface TuneStrategyModalProps {
  agentPda: string;
  ownerAddress: string;
  agentName: string;
  agentId: string;
  strategyUri?: string | null;
  buttonVariant?: "primary" | "secondary" | "outline";
  className?: string;
}

type Status =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "signing" }
  | { step: "done"; message: string }
  | { step: "error"; message: string };

export function TuneStrategyModal({
  agentPda,
  ownerAddress,
  agentName,
  agentId,
  strategyUri,
  buttonVariant = "secondary",
  className = "",
}: TuneStrategyModalProps) {
  const router = useRouter();
  const { publicKey, signMessage: signSolanaMessage } = useWallet();
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { signMessageAsync: signEvmMessage } = useSignMessage();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ step: "idle" });

  // Strategy Parameter Form State
  const [form, setForm] = useState<{
    rsiLowerThreshold: string;
    rsiUpperThreshold: string;
    thresholdBps: string;
    windowSize: string;
    gridSpacingBps: string;
    sizeUsd: string;
  }>({
    rsiLowerThreshold: "",
    rsiUpperThreshold: "",
    thresholdBps: "",
    windowSize: "",
    gridSpacingBps: "",
    sizeUsd: "",
  });

  const activeWallet = (publicKey?.toBase58() || evmAddress)?.toLowerCase();
  const isOwner = Boolean(activeWallet && activeWallet === ownerAddress.toLowerCase());
  const canSign = Boolean((publicKey && signSolanaMessage) || (isEvmConnected && signEvmMessage));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect strategy type
  const isMeanReversion =
    agentId.toLowerCase().includes("mean-reversion") ||
    agentId.toLowerCase().includes("rsi") ||
    strategyUri?.toLowerCase().includes("mean-reversion");

  const isMomentum =
    agentId.toLowerCase().includes("momentum") ||
    strategyUri?.toLowerCase().includes("momentum");

  const isGrid =
    agentId.toLowerCase().includes("grid") ||
    strategyUri?.toLowerCase().includes("grid");

  const loadCurrentParams = useCallback(async () => {
    setStatus({ step: "loading" });
    try {
      const { params } = await fetchStrategyParams(agentPda);
      setForm({
        rsiLowerThreshold: params.rsiLowerThreshold != null ? String(params.rsiLowerThreshold) : isMeanReversion ? "35" : "",
        rsiUpperThreshold: params.rsiUpperThreshold != null ? String(params.rsiUpperThreshold) : isMeanReversion ? "65" : "",
        thresholdBps: params.thresholdBps != null ? String(params.thresholdBps) : isMomentum ? "50" : "",
        windowSize: params.windowSize != null ? String(params.windowSize) : "14",
        gridSpacingBps: params.gridSpacingBps != null ? String(params.gridSpacingBps) : isGrid ? "20" : "",
        sizeUsd: params.sizeUsd != null ? String(params.sizeUsd) : "25",
      });
      setStatus({ step: "idle" });
    } catch {
      // Set sensible defaults if none yet saved in database
      setForm({
        rsiLowerThreshold: isMeanReversion ? "35" : "",
        rsiUpperThreshold: isMeanReversion ? "65" : "",
        thresholdBps: isMomentum ? "50" : "",
        windowSize: "14",
        gridSpacingBps: isGrid ? "20" : "",
        sizeUsd: "25",
      });
      setStatus({ step: "idle" });
    }
  }, [agentPda, isMeanReversion, isMomentum, isGrid]);

  const handleOpen = () => {
    setIsOpen(true);
    loadCurrentParams();
  };

  const handleClose = () => {
    setIsOpen(false);
    setStatus({ step: "idle" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSign) {
      setStatus({ step: "error", message: "Please connect your owner wallet to sign." });
      return;
    }
    if (!isOwner) {
      setStatus({
        step: "error",
        message: "Only this agent's owner wallet can tune its strategy parameters.",
      });
      return;
    }

    setStatus({ step: "signing" });

    try {
      // Build cleaned strategy parameters payload
      const cleaned: StrategyParams = {};
      if (form.rsiLowerThreshold) cleaned.rsiLowerThreshold = Number(form.rsiLowerThreshold);
      if (form.rsiUpperThreshold) cleaned.rsiUpperThreshold = Number(form.rsiUpperThreshold);
      if (form.thresholdBps) cleaned.thresholdBps = Number(form.thresholdBps);
      if (form.windowSize) cleaned.windowSize = Number(form.windowSize);
      if (form.gridSpacingBps) cleaned.gridSpacingBps = Number(form.gridSpacingBps);
      if (form.sizeUsd) cleaned.sizeUsd = Number(form.sizeUsd);

      const nonce = crypto.randomUUID();
      const message = tuneAgentMessage(agentPda, nonce);

      let signatureHex = "";
      if (ownerAddress.startsWith("0x") && signEvmMessage) {
        signatureHex = await signEvmMessage({ message });
      } else if (signSolanaMessage) {
        const sigBytes = await signSolanaMessage(new TextEncoder().encode(message));
        signatureHex = bs58.encode(sigBytes);
      } else {
        throw new Error("No compatible wallet signer found.");
      }

      await setStrategyParams(agentPda, cleaned, nonce, signatureHex);

      setStatus({
        step: "done",
        message: "Strategy parameters tuned and logged! Active on next execution cycle.",
      });

      setTimeout(() => {
        router.refresh();
      }, 1200);
    } catch (err) {
      setStatus({
        step: "error",
        message: err instanceof Error ? err.message : "Failed to tune agent parameters.",
      });
    }
  };

  return (
    <>
      <Button
        variant={buttonVariant}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 ${className}`}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <circle cx="8" cy="8" r="2.5" />
          <path d="M13.5 8a5.5 5.5 0 0 0-.1-1l1.3-.9-1-1.8-1.5.5a5.5 5.5 0 0 0-1.7-1l-.3-1.6h-2.1l-.3 1.6a5.5 5.5 0 0 0-1.7 1l-1.5-.5-1 1.8 1.3.9a5.5 5.5 0 0 0 0 2l-1.3.9 1 1.8 1.5-.5a5.5 5.5 0 0 0 1.7 1l.3 1.6h2.1l.3-1.6a5.5 5.5 0 0 0 1.7-1l1.5.5 1-1.8-1.3-.9c.1-.3.1-.7.1-1z" />
        </svg>
        <span>Tune Strategy</span>
      </Button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleClose}
                  className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                />

                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background-elevated p-6 shadow-2xl"
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h3 className="t-h3 text-foreground">Tune Strategy Parameters</h3>
                      <p className="mt-0.5 font-mono text-xs text-foreground-muted">
                        {agentName} ({agentId})
                      </p>
                    </div>
                    <button
                      onClick={handleClose}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer"
                      aria-label="Close modal"
                    >
                      <XGlyph />
                    </button>
                  </div>

                  {!isOwner ? (
                    <div className="mt-6 rounded-xl border border-border bg-surface p-5 text-center">
                      <p className="text-sm font-medium text-foreground">Owner Authorization Required</p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        Only the verified owner address ({ownerAddress.slice(0, 6)}..{ownerAddress.slice(-4)}) can tune this agent.
                      </p>
                      {activeWallet ? (
                        <p className="mt-3 font-mono text-[11px] text-foreground-faint">
                          Connected: {activeWallet.slice(0, 6)}..{activeWallet.slice(-4)} (Not owner)
                        </p>
                      ) : (
                        <p className="mt-3 text-xs text-foreground-faint">
                          Please connect the owner wallet in the top right.
                        </p>
                      )}
                      <div className="mt-5 flex justify-center">
                        <Button variant="secondary" onClick={handleClose}>
                          Close
                        </Button>
                      </div>
                    </div>
                  ) : status.step === "done" ? (
                    <div className="mt-6 flex flex-col items-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-positive/30 bg-positive/10 text-positive">
                        <CheckGlyph className="h-6 w-6" />
                      </div>
                      <h4 className="mt-3 text-base font-semibold text-foreground">
                        Strategy Successfully Tuned
                      </h4>
                      <p className="mt-1 max-w-[340px] text-xs text-foreground-muted">
                        Your signature was verified and new parameters have been committed to on-chain state and recorded in the Tuning Log.
                      </p>

                      <div className="mt-5 w-full space-y-2 rounded-xl border border-border bg-background p-4 text-left font-mono text-xs">
                        <div className="flex justify-between text-foreground-muted">
                          <span>Agent:</span>
                          <span className="text-foreground">{agentName}</span>
                        </div>
                        {form.rsiLowerThreshold && (
                          <div className="flex justify-between text-foreground-muted">
                            <span>RSI Buy Threshold:</span>
                            <span className="font-bold text-positive">{form.rsiLowerThreshold}</span>
                          </div>
                        )}
                        {form.rsiUpperThreshold && (
                          <div className="flex justify-between text-foreground-muted">
                            <span>RSI Sell Threshold:</span>
                            <span className="font-bold text-positive">{form.rsiUpperThreshold}</span>
                          </div>
                        )}
                        {form.sizeUsd && (
                          <div className="flex justify-between text-foreground-muted">
                            <span>Trade Size:</span>
                            <span className="font-bold text-positive">${form.sizeUsd} USD</span>
                          </div>
                        )}
                        {form.windowSize && (
                          <div className="flex justify-between text-foreground-muted">
                            <span>Lookback Window:</span>
                            <span className="font-bold text-foreground">{form.windowSize} ticks</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 flex w-full justify-center">
                        <Button
                          className="w-full justify-center"
                          onClick={() => {
                            handleClose();
                            window.location.reload();
                          }}
                        >
                          Done & View Tuning Log
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                      <p className="text-xs text-foreground-muted">
                        Adjust execution thresholds below. When saved, the change is signed by your owner wallet, updated in the execution runtime, and recorded in the <strong>Tuning Log</strong>.
                      </p>

                      {/* RSI Mean Reversion Controls */}
                      {isMeanReversion && (
                        <div className="rounded-xl border border-border bg-background p-4 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="t-label text-foreground">RSI Mean Reversion Knobs</span>
                            <span className="font-mono text-[10px] text-foreground-faint">RSI Strategy</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-mono text-[11px] text-foreground-muted">
                                RSI Lower Threshold (Buy)
                              </label>
                              <input
                                type="number"
                                min={5}
                                max={45}
                                value={form.rsiLowerThreshold}
                                onChange={(e) => setForm({ ...form, rsiLowerThreshold: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                                placeholder="35 (5–45)"
                              />
                              <p className="mt-1 text-[10px] text-foreground-faint">Oversold level to open longs</p>
                            </div>

                            <div>
                              <label className="block font-mono text-[11px] text-foreground-muted">
                                RSI Upper Threshold (Sell)
                              </label>
                              <input
                                type="number"
                                min={55}
                                max={95}
                                value={form.rsiUpperThreshold}
                                onChange={(e) => setForm({ ...form, rsiUpperThreshold: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                                placeholder="65 (55–95)"
                              />
                              <p className="mt-1 text-[10px] text-foreground-faint">Overbought level to exit / short</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Momentum Controls */}
                      {isMomentum && (
                        <div className="rounded-xl border border-border bg-background p-4 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="t-label text-foreground">Momentum Knobs</span>
                            <span className="font-mono text-[10px] text-foreground-faint">Breakout Strategy</span>
                          </div>

                          <div>
                            <label className="block font-mono text-[11px] text-foreground-muted">
                              Momentum Threshold (bps)
                            </label>
                            <input
                              type="number"
                              min={10}
                              max={500}
                              value={form.thresholdBps}
                              onChange={(e) => setForm({ ...form, thresholdBps: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                              placeholder="50 (10–500 bps)"
                            />
                            <p className="mt-1 text-[10px] text-foreground-faint">Required basis points price move to enter</p>
                          </div>
                        </div>
                      )}

                      {/* General Sizing & Window Controls */}
                      <div className="rounded-xl border border-border bg-background p-4 space-y-3.5">
                        <span className="t-label text-foreground">Execution & Risk Knobs</span>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block font-mono text-[11px] text-foreground-muted">
                              Lookback Window (Ticks)
                            </label>
                            <input
                              type="number"
                              min={5}
                              max={100}
                              value={form.windowSize}
                              onChange={(e) => setForm({ ...form, windowSize: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                              placeholder="14 (5–100)"
                            />
                            <p className="mt-1 text-[10px] text-foreground-faint">Price tick window size</p>
                          </div>

                          <div>
                            <label className="block font-mono text-[11px] text-foreground-muted">
                              Trade Size ($ USD)
                            </label>
                            <input
                              type="number"
                              min={5}
                              max={1000}
                              value={form.sizeUsd}
                              onChange={(e) => setForm({ ...form, sizeUsd: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                              placeholder="25 ($5–$1,000)"
                            />
                            <p className="mt-1 text-[10px] text-foreground-faint">Notional position size</p>
                          </div>
                        </div>
                      </div>

                      {/* Status Feedback */}
                      {status.step === "error" && (
                        <div className="rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
                          {status.message}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                        <Button variant="secondary" type="button" onClick={handleClose}>
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={status.step === "signing"}
                        >
                          {status.step === "signing" ? "Signing in Wallet..." : "Save & Sign Tuning"}
                        </Button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
