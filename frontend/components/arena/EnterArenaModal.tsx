"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { Button } from "@/components/ui/Button";
import { CheckGlyph, XGlyph } from "@/components/ui/StatusGlyphs";
import {
  arenaEntryMessage,
  enterArena,
  fetchMyAgents,
  MyAgentSummary,
  setStrategyParams,
  StrategyParams,
  tuneAgentMessage,
} from "@/lib/leaderboardApi";

interface EnterArenaModalProps {
  seasonId: number;
}

type FormState = Record<keyof StrategyParams, string>;

const EMPTY_FORM: FormState = {
  thresholdBps: "",
  windowSize: "",
  gridSpacingBps: "",
  rsiLowerThreshold: "",
  rsiUpperThreshold: "",
  sizeUsd: "",
};

const FIELD_LABELS: Record<keyof StrategyParams, string> = {
  thresholdBps: "Momentum threshold (bps, 10–500)",
  windowSize: "Window size (ticks, 5–100)",
  gridSpacingBps: "Grid spacing (bps, 5–200)",
  rsiLowerThreshold: "RSI lower bound (5–45)",
  rsiUpperThreshold: "RSI upper bound (55–95)",
  sizeUsd: "Trade size (USD, 5–1000)",
};

type Status = { step: "idle" } | { step: "submitting" } | { step: "done" } | { step: "error"; message: string };

/** Only strategies matching the field they care about actually read it — an
 * irrelevant field left blank here is simply never sent, and if sent is
 * simply ignored by whichever strategy this agent runs. */
function parseForm(form: FormState): StrategyParams {
  const params: StrategyParams = {};
  for (const key of Object.keys(form) as (keyof StrategyParams)[]) {
    const raw = form[key].trim();
    if (raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) params[key] = n;
  }
  return params;
}

export function EnterArenaModal({ seasonId }: EnterArenaModalProps) {
  const { publicKey, signMessage } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [isOpen, setIsOpen] = useState(false);
  const [myAgents, setMyAgents] = useState<MyAgentSummary[] | null>(null);
  const [selectedAgentPda, setSelectedAgentPda] = useState<string>("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<Status>({ step: "idle" });

  async function handleOpen() {
    setIsOpen(true);
    if (!publicKey) return;
    try {
      const agents = await fetchMyAgents(publicKey.toBase58());
      setMyAgents(agents);
      if (agents.length > 0) setSelectedAgentPda(agents[0].agent_pda);
    } catch (err) {
      setStatus({ step: "error", message: err instanceof Error ? err.message : "Failed to load your agents." });
    }
  }

  async function handleSubmit() {
    if (!publicKey || !signMessage || !selectedAgentPda) return;
    setStatus({ step: "submitting" });
    try {
      const params = parseForm(form);
      if (Object.keys(params).length > 0) {
        const nonce = crypto.randomUUID();
        const tuneMsg = tuneAgentMessage(selectedAgentPda, nonce);
        const tuneSig = await signMessage(new TextEncoder().encode(tuneMsg));
        await setStrategyParams(selectedAgentPda, params, nonce, bs58.encode(tuneSig));
      }

      const entryMsg = arenaEntryMessage(seasonId, selectedAgentPda);
      const entrySig = await signMessage(new TextEncoder().encode(entryMsg));
      await enterArena(seasonId, selectedAgentPda, bs58.encode(entrySig));

      setStatus({ step: "done" });
    } catch (err) {
      setStatus({ step: "error", message: err instanceof Error ? err.message : "Failed to enter the arena." });
    }
  }

  return (
    <>
      <Button onClick={handleOpen}>Enter the Arena</Button>

      {mounted &&
        createPortal(
          <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg rounded-2xl border border-border bg-background-elevated p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="t-h3 text-foreground">Enter the Arena</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  aria-label="Close arena entry modal"
                >
                  <XGlyph />
                </button>
              </div>

              {!publicKey && (
                <p className="mt-5 text-sm text-foreground-muted">Connect a wallet to enter an agent.</p>
              )}

              {publicKey && status.step !== "done" && (
                <div className="mt-5 space-y-4">
                  {myAgents === null && status.step !== "error" && (
                    <p className="text-sm text-foreground-muted">Loading your agents...</p>
                  )}
                  {status.step === "error" && (
                    <p className="text-xs text-negative">{status.message}</p>
                  )}
                  {myAgents?.length === 0 && (
                    <p className="text-sm text-foreground-muted">
                      This wallet doesn&apos;t own any registered agents yet.
                    </p>
                  )}
                  {myAgents && myAgents.length > 0 && (
                    <>
                      <div>
                        <label className="t-label mb-2 block text-foreground-muted">Agent</label>
                        <select
                          value={selectedAgentPda}
                          onChange={(e) => setSelectedAgentPda(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                        >
                          {myAgents.map((agent) => (
                            <option key={agent.agent_pda} value={agent.agent_pda}>
                              {agent.name} ({agent.agent_id})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="t-label mb-2 text-foreground-muted">
                          Tune your strategy (optional — leave blank to keep current values)
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {(Object.keys(FIELD_LABELS) as (keyof StrategyParams)[]).map((key) => (
                            <div key={key}>
                              <label className="mb-1 block text-[0.6875rem] text-foreground-faint">
                                {FIELD_LABELS[key]}
                              </label>
                              <input
                                type="number"
                                value={form[key]}
                                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleSubmit}
                        disabled={status.step === "submitting" || !signMessage}
                        className="w-full justify-center"
                      >
                        {status.step === "submitting" ? "Signing..." : "Sign & Enter"}
                      </Button>
                      {!signMessage && (
                        <p className="text-xs text-foreground-faint">
                          Connected wallet doesn&apos;t support message signing.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {status.step === "done" && (
                <div className="mt-6 space-y-3 py-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-xl font-bold text-accent">
                    <CheckGlyph className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-foreground">Entered</h4>
                  <p className="text-xs text-foreground-muted">
                    Your agent is in this season&apos;s arena. Rankings update as it trades.
                  </p>
                  <Button variant="secondary" onClick={() => setIsOpen(false)}>
                    Close
                  </Button>
                </div>
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
