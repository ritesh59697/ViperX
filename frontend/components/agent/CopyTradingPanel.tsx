"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAccount, useSignMessage } from "wagmi";
import bs58 from "bs58";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RobotLogo } from "@/components/ui/RobotLogo";
import {
  unfollowAgent,
  followAgentMessage,
  fetchMyAgents,
  MyAgentSummary,
} from "@/lib/leaderboardApi";

interface CopyTradingPanelProps {
  agentPda: string;
  ownerAddress: string;
  copying: {
    sourceAgentPda: string;
    sourceAgentName: string;
    sourceAgentId: string;
    sizeUsd: string;
  } | null;
  followers: {
    followerAgentPda: string;
    followerAgentName: string;
    followerAgentId: string;
    sizeUsd: string;
  }[];
}

type Status =
  | { step: "idle" }
  | { step: "unfollowing" }
  | { step: "done" }
  | { step: "error"; message: string };

export function CopyTradingPanel({
  agentPda,
  ownerAddress,
  copying,
  followers,
}: CopyTradingPanelProps) {
  const { publicKey, signMessage: signSolanaMessage } = useWallet();
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { signMessageAsync: signEvmMessage } = useSignMessage();
  const router = useRouter();

  const [status, setStatus] = useState<Status>({ step: "idle" });
  const [unfollowingPda, setUnfollowingPda] = useState<string | null>(null);
  const [myAgents, setMyAgents] = useState<MyAgentSummary[] | null>(null);

  const activeWallet = (publicKey?.toBase58() || evmAddress)?.toLowerCase();
  const canSign = Boolean((publicKey && signSolanaMessage) || (isEvmConnected && signEvmMessage));
  const isOwner = Boolean(activeWallet && activeWallet === ownerAddress.toLowerCase());

  useEffect(() => {
    if (!activeWallet) {
      setMyAgents(null);
      return;
    }
    fetchMyAgents(activeWallet)
      .then(setMyAgents)
      .catch(() => setMyAgents([]));
  }, [activeWallet]);

  async function handleUnfollow() {
    if (!copying || !canSign) return;

    setStatus({ step: "unfollowing" });
    try {
      const nonce = crypto.randomUUID();
      const message = followAgentMessage(agentPda, copying.sourceAgentPda, nonce);
      let signature = "";
      if (publicKey && signSolanaMessage) {
        const sig = await signSolanaMessage(new TextEncoder().encode(message));
        signature = bs58.encode(sig);
      } else if (isEvmConnected && signEvmMessage) {
        signature = await signEvmMessage({ message });
      }

      await unfollowAgent(agentPda, copying.sourceAgentPda, nonce, signature);
      setStatus({ step: "done" });
      router.refresh();
    } catch (err) {
      setStatus({
        step: "error",
        message: err instanceof Error ? err.message : "Failed to cancel copy subscription.",
      });
    }
  }

  async function handleUnfollowFollower(followerAgentPda: string) {
    if (!canSign) return;

    setUnfollowingPda(followerAgentPda);
    setStatus({ step: "unfollowing" });
    try {
      const nonce = crypto.randomUUID();
      const message = followAgentMessage(followerAgentPda, agentPda, nonce);
      let signature = "";
      if (publicKey && signSolanaMessage) {
        const sig = await signSolanaMessage(new TextEncoder().encode(message));
        signature = bs58.encode(sig);
      } else if (isEvmConnected && signEvmMessage) {
        signature = await signEvmMessage({ message });
      }

      await unfollowAgent(followerAgentPda, agentPda, nonce, signature);
      setStatus({ step: "done" });
      router.refresh();
    } catch (err) {
      setStatus({
        step: "error",
        message: err instanceof Error ? err.message : "Failed to cancel copy subscription.",
      });
    } finally {
      setUnfollowingPda(null);
    }
  }

  return (
    <div className="mt-10 space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left Column: Copying Strategy */}
        <div className="flex flex-col">
          <h3 className="t-h3 mb-3 text-foreground">Copying Strategy</h3>
          {copying ? (
            <Card className="relative flex flex-1 flex-col justify-between overflow-hidden border-accent/20 bg-gradient-to-br from-background-elevated to-accent/5 p-5 min-h-[170px] transition-all hover:border-accent/30">
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-accent">
                    Active Copy Subscription
                  </span>
                </div>
                <div>
                  <h4 className="t-h4 font-bold text-foreground">
                    <Link
                      href={`/agents/${copying.sourceAgentPda}`}
                      className="hover:text-accent hover:underline"
                    >
                      {copying.sourceAgentName}
                    </Link>
                  </h4>
                  <p className="font-mono text-xs text-foreground-faint mt-0.5">
                    {copying.sourceAgentId.trim()}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <div>
                    <span className="block text-[0.6875rem] uppercase tracking-wider text-foreground-muted">
                      Allocation Size
                    </span>
                    <span className="font-mono text-sm font-bold text-foreground">
                      ${Number(copying.sizeUsd).toFixed(2)} USD
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[0.6875rem] uppercase tracking-wider text-foreground-muted">
                      Target Address
                    </span>
                    <span className="font-mono text-xs text-foreground-faint">
                      {copying.sourceAgentPda.slice(0, 6)}..{copying.sourceAgentPda.slice(-4)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-border/60 pt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  href={`/agents/${copying.sourceAgentPda}`}
                  className="!px-3 !py-1.5 !text-xs !h-8 flex-1 justify-center"
                >
                  View Source Agent ↗
                </Button>

                {isOwner && status.step !== "done" && (
                  <Button
                    variant="secondary"
                    onClick={handleUnfollow}
                    disabled={status.step === "unfollowing" || !canSign}
                    className="!px-3 !py-1.5 !text-xs !h-8 text-negative hover:border-negative/40 hover:bg-negative/5"
                  >
                    {status.step === "unfollowing" ? "Stopping..." : "Stop Copying"}
                  </Button>
                )}
              </div>

              {status.step === "error" && !unfollowingPda && (
                <p className="text-xs text-negative mt-2">{status.message}</p>
              )}

              {status.step === "done" && !unfollowingPda && (
                <div className="mt-2 rounded-lg border border-positive/20 bg-positive/5 p-2 text-center text-xs text-positive">
                  Subscription successfully cancelled.
                </div>
              )}
            </Card>
          ) : (
            <Card variant="muted" className="flex flex-1 min-h-[170px] flex-col items-center justify-center text-center p-6">
              <RobotLogo className="h-9 w-9 shrink-0 text-foreground" />
              <h4 className="mt-2 text-sm font-medium text-foreground">Autonomous Execution</h4>
              <p className="mt-1 text-xs text-foreground-muted max-w-[280px]">
                This agent is running its own autonomous logic on-chain and not copy-trading any other strategy.
              </p>
            </Card>
          )}
        </div>

        {/* Right Column: Followers */}
        <div className="flex flex-col">
          <h3 className="t-h3 mb-3 text-foreground">
            Followers ({followers.length})
          </h3>
          {followers.length > 0 ? (
            <div className="flex flex-1 flex-col gap-3">
              {followers.map((follower) => {
                const isMyFollower = Boolean(
                  myAgents?.some(
                    (a) => a.agent_pda.toLowerCase() === follower.followerAgentPda.toLowerCase()
                  ) ||
                  (activeWallet && follower.followerAgentPda.toLowerCase() === activeWallet)
                );
                const isUnfollowingThis =
                  status.step === "unfollowing" && unfollowingPda === follower.followerAgentPda;

                return (
                  <Card
                    key={follower.followerAgentPda}
                    className="relative flex flex-1 flex-col justify-between overflow-hidden border-border bg-gradient-to-br from-background-elevated to-surface p-5 min-h-[170px] transition-all hover:border-border-strong"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-accent">
                          Active Follower
                        </span>
                        {isMyFollower && (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-accent border border-accent/20">
                            Your Agent
                          </span>
                        )}
                      </div>

                      <h4 className="t-h4 mt-1.5 font-bold text-foreground">
                        <Link
                          href={`/agents/${follower.followerAgentPda}`}
                          className="hover:text-accent hover:underline"
                        >
                          {follower.followerAgentName}
                        </Link>
                      </h4>
                      <p className="font-mono text-xs text-foreground-faint mt-0.5">
                        {follower.followerAgentId.trim()}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-border/60 pt-3">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="block text-[0.6875rem] uppercase tracking-wider text-foreground-muted">
                            Copy Size
                          </span>
                          <span className="font-mono text-sm font-bold text-foreground">
                            ${Number(follower.sizeUsd).toFixed(2)} USD
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[0.6875rem] uppercase tracking-wider text-foreground-muted">
                            Agent Address
                          </span>
                          <span className="font-mono text-xs text-foreground-faint">
                            {follower.followerAgentPda.slice(0, 6)}..{follower.followerAgentPda.slice(-4)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          href={`/agents/${follower.followerAgentPda}`}
                          className="!px-3 !py-1.5 !text-xs !h-8 flex-1 justify-center"
                        >
                          View Agent ↗
                        </Button>

                        {isMyFollower && (
                          <Button
                            variant="secondary"
                            onClick={() => handleUnfollowFollower(follower.followerAgentPda)}
                            disabled={isUnfollowingThis || !canSign}
                            className="!px-3 !py-1.5 !text-xs !h-8 text-negative hover:border-negative/40 hover:bg-negative/5"
                          >
                            {isUnfollowingThis ? "Stopping..." : "Stop Copying"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {status.step === "error" && unfollowingPda === follower.followerAgentPda && (
                      <p className="text-xs text-negative mt-2">{status.message}</p>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card variant="muted" className="flex flex-1 min-h-[170px] flex-col items-center justify-center text-center p-6">
              <UsersIcon className="h-9 w-9 shrink-0 text-foreground-faint" />
              <h4 className="mt-2 text-sm font-medium text-foreground">No Copy Followers Yet</h4>
              <p className="mt-1 text-xs text-foreground-muted max-w-[280px]">
                Other users can copy this agent by clicking the &ldquo;Copy This Agent&rdquo; button above.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
