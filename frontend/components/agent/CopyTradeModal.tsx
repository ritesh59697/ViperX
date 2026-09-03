"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAccount, useSignMessage } from "wagmi";
import bs58 from "bs58";
import { Button } from "@/components/ui/Button";
import { CheckGlyph, XGlyph } from "@/components/ui/StatusGlyphs";
import {
  followAgent,
  followAgentMessage,
  unfollowAgent,
  fetchCopySubscriptions,
  fetchMyAgents,
  MyAgentSummary,
} from "@/lib/leaderboardApi";

interface CopyTradeModalProps {
  /** The agent being followed — this modal's own page's agent. */
  sourceAgentPda: string;
  agentName: string;
  agentId: string;
}

type Status =
  | { step: "idle" }
  | { step: "submitting" }
  | { step: "done" }
  | { step: "unfollowing" }
  | { step: "unfollowed" }
  | { step: "error"; message: string };

/** An existing subscription of the caller's onto this page's agent. */
interface ActiveFollow {
  followerAgentPda: string;
  followerLabel: string;
  sizeUsd: number;
}

const MIN_SIZE_USD = 5;
const MAX_SIZE_USD = 1000;

export function CopyTradeModal({ sourceAgentPda, agentName, agentId }: CopyTradeModalProps) {
  const { publicKey, signMessage: signSolanaMessage } = useWallet();
  const { isConnected: isEvmConnected, address: evmAddress } = useAccount();
  const { signMessageAsync: signEvmMessage } = useSignMessage();
  const [isOpen, setIsOpen] = useState(false);
  const [myAgents, setMyAgents] = useState<MyAgentSummary[] | null>(null);
  const [activeFollow, setActiveFollow] = useState<ActiveFollow | null>(null);
  const [selectedFollowerPda, setSelectedFollowerPda] = useState<string>("");
  const [sizeUsd, setSizeUsd] = useState("25");
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const activeWalletAddress = publicKey?.toBase58() || evmAddress;
  const canSign = Boolean((publicKey && signSolanaMessage) || (isEvmConnected && signEvmMessage));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function loadState(owner: string) {
    // Both reads are needed before we know which UI to show, and neither
    // depends on the other — fetch them together so the modal doesn't flash
    // the subscribe form before discovering an existing subscription.
    const [agents, subscriptions] = await Promise.all([
      fetchMyAgents(owner),
      fetchCopySubscriptions(),
    ]);
    const eligible = agents.filter((a) => a.agent_pda !== sourceAgentPda);
    setMyAgents(eligible);
    if (eligible.length > 0) setSelectedFollowerPda(eligible[0].agent_pda);

    // The bulk endpoint returns every active subscription, so narrow it to
    // one where an agent *I* own follows *this* page's agent.
    const mine = new Map(eligible.map((a) => [a.agent_pda, a]));
    const existing = subscriptions.find(
      (s) => s.sourceAgentPda === sourceAgentPda && mine.has(s.followerAgentPda)
    );
    if (existing) {
      const follower = mine.get(existing.followerAgentPda)!;
      setActiveFollow({
        followerAgentPda: existing.followerAgentPda,
        followerLabel: `${follower.name} (${follower.agent_id})`,
        sizeUsd: Number(existing.sizeUsd),
      });
    } else {
      setActiveFollow(null);
    }
  }

  async function handleOpen() {
    setIsOpen(true);
    if (!activeWalletAddress) return;
    try {
      await loadState(activeWalletAddress);
    } catch (err) {
      setStatus({ step: "error", message: err instanceof Error ? err.message : "Failed to load your agents." });
    }
  }

  function handleClose() {
    setIsOpen(false);
    setStatus({ step: "idle" });
    setMyAgents(null);
    setActiveFollow(null);
  }

  async function handleUnfollow() {
    if (!activeWalletAddress || !activeFollow) return;

    setStatus({ step: "unfollowing" });
    try {
      const nonce = crypto.randomUUID();
      const message = followAgentMessage(activeFollow.followerAgentPda, sourceAgentPda, nonce);
      let sigStr = "";
      if (publicKey && signSolanaMessage) {
        const signature = await signSolanaMessage(new TextEncoder().encode(message));
        sigStr = bs58.encode(signature);
      } else if (isEvmConnected && signEvmMessage) {
        sigStr = await signEvmMessage({ message });
      }
      await unfollowAgent(activeFollow.followerAgentPda, sourceAgentPda, nonce, sigStr);
      setActiveFollow(null);
      setStatus({ step: "unfollowed" });
    } catch (err) {
      setStatus({ step: "error", message: err instanceof Error ? err.message : "Failed to cancel the subscription." });
    }
  }

  async function handleSubmit() {
    if (!activeWalletAddress || !selectedFollowerPda) return;
    const size = Number(sizeUsd);
    if (!Number.isFinite(size) || size < MIN_SIZE_USD || size > MAX_SIZE_USD) {
      setStatus({ step: "error", message: `Size must be between $${MIN_SIZE_USD} and $${MAX_SIZE_USD}.` });
      return;
    }

    setStatus({ step: "submitting" });
    try {
      const nonce = crypto.randomUUID();
      const message = followAgentMessage(selectedFollowerPda, sourceAgentPda, nonce);
      let sigStr = "";
      if (publicKey && signSolanaMessage) {
        const signature = await signSolanaMessage(new TextEncoder().encode(message));
        sigStr = bs58.encode(signature);
      } else if (isEvmConnected && signEvmMessage) {
        sigStr = await signEvmMessage({ message });
      }
      await followAgent(selectedFollowerPda, sourceAgentPda, size, nonce, sigStr);
      setStatus({ step: "done" });
    } catch (err) {
      setStatus({ step: "error", message: err instanceof Error ? err.message : "Failed to create the subscription." });
    }
  }

  return (
    <>
      <Button onClick={handleOpen}>Copy This Agent</Button>

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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg rounded-2xl border border-border bg-background-elevated p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="t-h3 text-foreground">Copy {agentName}</h3>
                  <p className="mt-0.5 font-mono text-xs text-foreground-muted">{agentId}</p>
                </div>
                <button
                  onClick={handleClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  aria-label="Close copy-trading modal"
                >
                  <XGlyph />
                </button>
              </div>

              {!activeWalletAddress && (
                <p className="mt-5 text-sm text-foreground-muted">Connect a Solana or Base wallet to copy this agent.</p>
              )}

              {activeWalletAddress && activeFollow && status.step !== "unfollowed" && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="t-label text-foreground-muted">Currently following</p>
                    <p className="mt-1.5 text-sm text-foreground">{activeFollow.followerLabel}</p>
                    <p className="mt-0.5 text-xs text-foreground-faint">
                      Mirroring at ${activeFollow.sizeUsd} per trade
                    </p>
                  </div>

                  <p className="text-xs text-foreground-faint">
                    Unfollowing stops your agent from mirroring new trades once its runtime picks up
                    the change. It does not close any position your agent already holds — close
                    those from your own agent&apos;s page.
                  </p>

                  {status.step === "error" && (
                    <p className="text-xs text-negative">{status.message}</p>
                  )}

                  <Button
                    variant="secondary"
                    onClick={handleUnfollow}
                    disabled={status.step === "unfollowing" || !canSign}
                    className="w-full justify-center"
                  >
                    {status.step === "unfollowing" ? "Signing..." : "Unfollow"}
                  </Button>
                  {!canSign && (
                    <p className="text-xs text-foreground-faint">
                      Connected wallet doesn&apos;t support message signing.
                    </p>
                  )}
                </div>
              )}

              {activeWalletAddress && !activeFollow && status.step !== "done" && status.step !== "unfollowed" && (
                <div className="mt-5 space-y-4">
                  <p className="text-xs text-foreground-faint">
                    Picks one of your own registered agents to mirror this agent&apos;s trades — same
                    direction, at your own size, next time your agent&apos;s runtime restarts. Free in
                    this phase: no fee, no fund transfer, just a signed subscription.
                  </p>

                  {myAgents === null && status.step !== "error" && (
                    <p className="text-sm text-foreground-muted">Loading your agents...</p>
                  )}
                  {status.step === "error" && (
                    <p className="text-xs text-negative">{status.message}</p>
                  )}
                  {myAgents?.length === 0 && (
                    <p className="text-sm text-foreground-muted">
                      You need another registered agent (not this one) to use as the follower —
                      register one first from the create-agent page.
                    </p>
                  )}
                  {myAgents && myAgents.length > 0 && (
                    <>
                      <div>
                        <label className="t-label mb-2 block text-foreground-muted">
                          Your agent (will follow this one)
                        </label>
                        <select
                          value={selectedFollowerPda}
                          onChange={(e) => setSelectedFollowerPda(e.target.value)}
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
                        <label className="t-label mb-2 block text-foreground-muted">
                          Size per mirrored trade (${MIN_SIZE_USD}–${MAX_SIZE_USD})
                        </label>
                        <div className="flex items-center rounded-lg border border-border bg-background px-3 py-2">
                          <span className="text-sm text-foreground-muted">$</span>
                          <input
                            type="number"
                            min={MIN_SIZE_USD}
                            max={MAX_SIZE_USD}
                            value={sizeUsd}
                            onChange={(e) => setSizeUsd(e.target.value)}
                            className="w-full bg-transparent px-2 text-sm text-foreground outline-none"
                          />
                          <span className="text-xs text-foreground-faint">USD</span>
                        </div>
                      </div>

                      <Button
                        onClick={handleSubmit}
                        disabled={status.step === "submitting" || !canSign}
                        className="w-full justify-center"
                      >
                        {status.step === "submitting" ? "Signing..." : "Sign & Copy"}
                      </Button>
                      {!canSign && (
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
                  <h4 className="text-base font-bold text-foreground">Subscription created</h4>
                  <p className="text-xs text-foreground-muted">
                    Your agent will mirror {agentName}&apos;s trades at your chosen size once its
                    runtime picks up the new subscription.
                  </p>
                  <Button variant="secondary" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              )}

              {status.step === "unfollowed" && (
                <div className="mt-6 space-y-3 py-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background text-xl font-bold text-foreground-muted">
                    <CheckGlyph className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-foreground">Subscription cancelled</h4>
                  <p className="text-xs text-foreground-muted">
                    Your agent will stop mirroring {agentName}&apos;s trades once its runtime picks
                    up the change. Any position it already holds stays open.
                  </p>
                  <Button variant="secondary" onClick={handleClose}>
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
