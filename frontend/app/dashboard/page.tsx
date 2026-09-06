"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamicImport from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAccount, useSignMessage } from "wagmi";
import bs58 from "bs58";
import {
  fetchUserDashboard,
  unfollowAgent,
  followAgentMessage,
  type DashboardAgent,
  type CopyRelationship,
} from "@/lib/leaderboardApi";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GridLoader } from "@/components/ui/GridLoader";

const BaseConnectButton = dynamicImport(
  () => import("@/components/ui/BaseConnectButton").then((mod) => mod.BaseConnectButton),
  { ssr: false },
);

const SolanaConnectButton = dynamicImport(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false },
);

function getStoredActiveChain(): "solana" | "base" {
  if (typeof window === "undefined") return "base";
  const saved = localStorage.getItem("viperx-active-chain");
  return saved === "solana" || saved === "base" ? saved : "base";
}

export default function DashboardPage() {
  const [activeChain, setActiveChain] = useState<"solana" | "base">(getStoredActiveChain);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [copying, setCopying] = useState<CopyRelationship[]>([]);
  const [followers, setFollowers] = useState<CopyRelationship[]>([]);
  const [unfollowingPda, setUnfollowingPda] = useState<string | null>(null);

  const [queryAddress, setQueryAddress] = useState<string | null>(null);

  // Wallets
  const { publicKey: solPublicKey, signMessage: solSignMessage } = useWallet();
  const { address: evmAddress } = useAccount();
  const { signMessageAsync: evmSignMessage } = useSignMessage();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const qp = new URLSearchParams(window.location.search);
      const qWallet = qp.get("wallet") || qp.get("address");
      if (qWallet) {
        setQueryAddress(qWallet);
        if (qWallet.startsWith("0x")) {
          setActiveChain("base");
        } else if (qWallet.length >= 32 && qWallet.length <= 44) {
          setActiveChain("solana");
        }
      }
    }
  }, []);

  const connectedAddress = (activeChain === "solana" ? solPublicKey?.toBase58() : evmAddress) || queryAddress;

  useEffect(() => {
    const updateNetwork = () => {
      setActiveChain(getStoredActiveChain());
    };
    window.addEventListener("storage", updateNetwork);
    window.addEventListener("viperx-chain-changed", updateNetwork);
    return () => {
      window.removeEventListener("storage", updateNetwork);
      window.removeEventListener("viperx-chain-changed", updateNetwork);
    };
  }, []);

  // Fetch Dashboard data
  useEffect(() => {
    if (!connectedAddress) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    fetchUserDashboard(connectedAddress)
      .then((data) => {
        if (cancelled) return;
        setAgents(data.agents);
        setCopying(data.copying);
        setFollowers(data.followers);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connectedAddress]);

  // Handle unfollowing a strategy
  async function handleUnfollow(followerPda: string, sourcePda: string) {
    if (!connectedAddress) return;
    setUnfollowingPda(followerPda);
    try {
      const nonce = crypto.randomUUID();
      const message = followAgentMessage(followerPda, sourcePda, nonce);
      
      let signatureStr = "";
      if (activeChain === "solana") {
        if (!solSignMessage) throw new Error("Solana wallet does not support message signing");
        const signatureBytes = await solSignMessage(new TextEncoder().encode(message));
        signatureStr = bs58.encode(signatureBytes);
      } else {
        if (!evmSignMessage) throw new Error("EVM Wallet not ready");
        signatureStr = await evmSignMessage({ message });
      }

      await unfollowAgent(followerPda, sourcePda, nonce, signatureStr);
      
      // Update local copying state
      setCopying((prev) => prev.filter((c) => !(c.followerAgentPda === followerPda && c.sourceAgentPda === sourcePda)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel copy subscription");
    } finally {
      setUnfollowingPda(null);
    }
  }

  const shortenedAddress = connectedAddress
    ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`
    : "";

  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <div className="w-full flex flex-col gap-8 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl">
        {/* Dashboard Title & Wallet Info */}
        <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 sm:flex-row sm:items-end">
          <div>
            <span className="t-label">Workspace</span>
            <h1 className="text-3xl sm:text-4xl font-bold font-mono text-foreground mt-2 tracking-tight">Wallet Dashboard</h1>
            <p className="t-body mt-2 max-w-[54ch] text-sm">
              Monitor your deployed SV/EV agents, active copy subscriptions, and strategy performance.
            </p>
          </div>

          {connectedAddress && (
            <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
              <div className="flex flex-col gap-1 font-mono text-xs sm:text-right rounded-lg bg-white p-3 sm:px-4 dark:bg-[#0a0a0a]">
                <span className="text-foreground-muted text-[11px]">Connected Wallet</span>
                <span className="font-semibold text-foreground tracking-wide">{shortenedAddress}</span>
                <span className="text-[10px] text-foreground-faint uppercase tracking-wider font-semibold">
                  {activeChain === "solana" ? "Solana Devnet" : "Base Sepolia"}
                </span>
              </div>
            </div>
          )}
        </div>

        {connectedAddress && (
          <div className="space-y-10">
            {/* Quick Stats Grid — ReactBits Compound Card Styling */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Card 1: Bots Deployed */}
              <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
                <div className="flex h-full flex-col justify-between rounded-lg bg-white p-5 transition-colors dark:bg-[#0a0a0a]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted truncate">
                      Bots Deployed
                    </span>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-accent transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent/5 dark:border-white/10 dark:bg-white/[0.04]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M12 8V4H8" />
                        <rect width="16" height="12" x="4" y="8" rx="2" />
                        <path d="M9 13h.01" />
                        <path d="M15 13h.01" />
                        <path d="M12 17v1" />
                        <path d="M8 21h8" />
                      </svg>
                    </div>
                  </div>
                  <span className="mt-3 block font-mono text-3xl font-bold tracking-tight text-foreground">{agents.length}</span>
                </div>
              </div>

              {/* Card 2: Copy Subscriptions */}
              <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
                <div className="flex h-full flex-col justify-between rounded-lg bg-white p-5 transition-colors dark:bg-[#0a0a0a]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted truncate">
                      Copy Subscriptions
                    </span>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-accent transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent/5 dark:border-white/10 dark:bg-white/[0.04]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="m17 2 4 4-4 4" />
                        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                        <path d="m7 22-4-4 4-4" />
                        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                      </svg>
                    </div>
                  </div>
                  <span className="mt-3 block font-mono text-3xl font-bold tracking-tight text-foreground">{copying.length}</span>
                </div>
              </div>

              {/* Card 3: Your Followers */}
              <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
                <div className="flex h-full flex-col justify-between rounded-lg bg-white p-5 transition-colors dark:bg-[#0a0a0a]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-foreground-muted truncate">
                      Your Followers
                    </span>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/[0.03] text-accent transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent/5 dark:border-white/10 dark:bg-white/[0.04]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                  </div>
                  <span className="mt-3 block font-mono text-3xl font-bold tracking-tight text-foreground">{followers.length}</span>
                </div>
              </div>
            </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <GridLoader size={50} label="Loading workspace data..." />
            </div>
          ) : error ? (
            <Card variant="error">{error}</Card>
          ) : (
            <>
              {/* SECTION 1: MY DEPLOYED BOTS (live only) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="font-mono text-sm font-semibold text-foreground">My Live Bots</h2>
                  <Button href="/create" className="py-1 px-3 text-xs">Deploy Bot</Button>
                </div>

                {agents.filter(a => !a.isPaper).length === 0 ? (
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                    <div className="rounded-lg bg-white py-10 px-4 text-center font-mono text-xs text-foreground-muted dark:bg-[#0a0a0a]">
                      No live bots registered under this wallet yet. Click &quot;Deploy Bot&quot; above to create one.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                    <div className="overflow-x-auto rounded-lg bg-white dark:bg-[#0a0a0a]">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-black/5 bg-neutral-50 text-foreground-muted uppercase tracking-wider text-[10px] dark:border-white/5 dark:bg-[#111111]">
                            <th className="p-4">Agent ID</th>
                            <th className="p-4">Name</th>
                            <th className="p-4">Chain</th>
                            <th className="p-4">Vault Balance</th>
                            <th className="p-4">Trades</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agents.filter(a => !a.isPaper).map((agent) => (
                            <tr key={agent.agentPda} className="border-b border-black/5 transition-colors hover:bg-neutral-50 dark:border-white/5 dark:hover:bg-white/[0.02] last:border-b-0">
                              <td className="p-4 font-semibold text-foreground">
                                <Link href={`/agents/${agent.agentPda}`} className="hover:underline">
                                  {agent.agentId}
                                </Link>
                              </td>
                              <td className="p-4 text-foreground-muted">{agent.name}</td>
                              <td className="p-4">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                  agent.chain === "base"
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                }`}>
                                  {agent.chain}
                                </span>
                              </td>
                              <td className="p-4 text-foreground font-semibold">
                                ${Number(agent.vaultBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-foreground-muted">{agent.tradeCount}</td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                                  agent.status === "Active" ? "text-positive" : "text-foreground-faint"
                                }`}>
                                  {agent.status === "Active" && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
                                  )}
                                  {agent.status}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <Button href={`/agents/${agent.agentPda}`} variant="secondary" className="py-1 px-2.5 text-[11px]">
                                  Manage
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* PAPER BOTS SECTION */}
              {agents.filter(a => a.isPaper).length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-mono text-sm font-semibold text-foreground">Paper Trading Bots</h2>
                      <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold uppercase text-foreground-faint">
                        PAPER
                      </span>
                    </div>
                    <Button href="/create" className="py-1 px-3 text-xs" variant="secondary">+ Paper Bot</Button>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                    <div className="rounded-lg bg-white px-4 py-3 dark:bg-[#0a0a0a]">
                      <div className="flex items-start gap-2.5 text-foreground-muted">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-accent">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <p className="font-mono text-[11px] leading-relaxed">
                          Paper bots use live Binance prices with simulated capital. Results are permanently excluded from leaderboard rankings, verified PnL, reputation, and copy-trading.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                    <div className="overflow-x-auto rounded-lg bg-white dark:bg-[#0a0a0a]">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-black/5 bg-neutral-50 text-foreground-muted uppercase tracking-wider text-[10px] dark:border-white/5 dark:bg-[#111111]">
                            <th className="p-4">Agent ID</th>
                            <th className="p-4">Name</th>
                            <th className="p-4">Chain</th>
                            <th className="p-4">Simulated Balance</th>
                            <th className="p-4">Trades</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agents.filter(a => a.isPaper).map((agent) => (
                            <tr key={agent.agentPda} className="border-b border-black/5 transition-colors hover:bg-neutral-50 dark:border-white/5 dark:hover:bg-white/[0.02] last:border-b-0">
                              <td className="p-4 font-semibold text-foreground">
                                <Link href={`/agents/${agent.agentPda}`} className="hover:underline">
                                  {agent.agentId}
                                </Link>
                              </td>
                              <td className="p-4 text-foreground-muted">{agent.name}</td>
                              <td className="p-4">
                                <span className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase text-foreground-muted">
                                  PAPER / {agent.chain}
                                </span>
                              </td>
                              <td className="p-4 font-semibold text-foreground">
                                ${Number(agent.simulatedBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span className="ml-1 text-[9px] uppercase text-foreground-faint font-normal">simulated</span>
                              </td>
                              <td className="p-4 text-foreground-muted">{agent.tradeCount}</td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                                  agent.status === "Active" ? "text-positive" : "text-foreground-faint"
                                }`}>
                                  {agent.status === "Active" && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
                                  )}
                                  {agent.status}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <Button href={`/agents/${agent.agentPda}`} variant="secondary" className="py-1 px-2.5 text-[11px]">
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: ACTIVE COPY-TRADING SUBSCRIPTIONS */}
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <h2 className="font-mono text-sm font-semibold text-foreground">Copy-Trading Subscriptions</h2>
                </div>

                {copying.length === 0 ? (
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                    <div className="rounded-lg bg-white py-10 px-4 text-center font-mono text-xs text-foreground-muted dark:bg-[#0a0a0a]">
                      Your bots are not copy-trading any other strategy yet. Explore the leaderboard to follow top performers.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                    <div className="overflow-x-auto rounded-lg bg-white dark:bg-[#0a0a0a]">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-black/5 bg-neutral-50 text-foreground-muted uppercase tracking-wider text-[10px] dark:border-white/5 dark:bg-[#111111]">
                            <th className="p-4">My Follower Bot</th>
                            <th className="p-4">Source Bot (Copied)</th>
                            <th className="p-4">Allocated Size</th>
                            <th className="p-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {copying.map((relationship) => (
                            <tr key={`${relationship.followerAgentPda}-${relationship.sourceAgentPda}`} className="border-b border-black/5 transition-colors hover:bg-neutral-50 dark:border-white/5 dark:hover:bg-white/[0.02] last:border-b-0">
                              <td className="p-4 text-foreground font-semibold">
                                <Link href={`/agents/${relationship.followerAgentPda}`} className="hover:underline">
                                  {relationship.followerAgentId}
                                </Link>
                              </td>
                              <td className="p-4 text-foreground-muted">
                                <Link href={`/agents/${relationship.sourceAgentPda}`} className="hover:underline text-accent">
                                  {relationship.sourceAgentId}
                                </Link>
                              </td>
                              <td className="p-4 text-foreground font-semibold">${Number(relationship.sizeUsd).toFixed(0)} USD</td>
                              <td className="p-4 text-right">
                                <Button
                                  onClick={() => handleUnfollow(relationship.followerAgentPda, relationship.sourceAgentPda)}
                                  disabled={unfollowingPda === relationship.followerAgentPda}
                                  variant="secondary"
                                  className="py-1 px-2.5 text-[11px] !text-negative hover:bg-negative/10"
                                >
                                  {unfollowingPda === relationship.followerAgentPda ? "Cancelling..." : "Unfollow"}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: MY BOT FOLLOWERS */}
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <h2 className="font-mono text-sm font-semibold text-foreground">My Bot Followers</h2>
                </div>

                {followers.length === 0 ? (
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                    <div className="rounded-lg bg-white py-10 px-4 text-center font-mono text-xs text-foreground-muted dark:bg-[#0a0a0a]">
                      No other users are copy-trading your bots yet. Build a strong track record to rank on the leaderboard and attract subscribers!
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                    <div className="overflow-x-auto rounded-lg bg-white dark:bg-[#0a0a0a]">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-black/5 bg-neutral-50 text-foreground-muted uppercase tracking-wider text-[10px] dark:border-white/5 dark:bg-[#111111]">
                            <th className="p-4">My Bot (Source)</th>
                            <th className="p-4">Follower Bot Address</th>
                            <th className="p-4">Follower Bot Name</th>
                            <th className="p-4">Allocated Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {followers.map((relationship) => (
                            <tr key={`${relationship.followerAgentPda}-${relationship.sourceAgentPda}`} className="border-b border-black/5 transition-colors hover:bg-neutral-50 dark:border-white/5 dark:hover:bg-white/[0.02] last:border-b-0">
                              <td className="p-4 text-foreground font-semibold">
                                <Link href={`/agents/${relationship.sourceAgentPda}`} className="hover:underline">
                                  {relationship.sourceAgentId}
                                </Link>
                              </td>
                              <td className="p-4 font-mono text-foreground-muted">
                                {relationship.followerAgentPda.slice(0, 8)}...{relationship.followerAgentPda.slice(-6)}
                              </td>
                              <td className="p-4 text-foreground-muted">{relationship.followerAgentId}</td>
                              <td className="p-4 text-foreground font-semibold">${Number(relationship.sizeUsd).toFixed(0)} USD</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Disconnected State Fallback Banner */}
      {!connectedAddress && (
        <div className="mt-8 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-white p-12 text-center font-mono text-xs dark:bg-[#0a0a0a]">
            <span className="text-foreground-muted">Connect your wallet to initialize this workspace.</span>
            <div className="flex gap-4">
              {activeChain === "solana" ? <SolanaConnectButton /> : <BaseConnectButton />}
            </div>
          </div>
        </div>
      )}
      </div>
    </Section>
  );
}
