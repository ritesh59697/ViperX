"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import dynamicImport from "next/dynamic";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSignMessage } from "wagmi";
import bs58 from "bs58";
import { indexOnchainBaseAgent, registerPaperAgent } from "@/lib/leaderboardApi";
import { baseAgentKey } from "@/lib/baseAgentKey";
import {
  AGENT_SPACE,
  getAgentPda,
  getRegistryProgram,
  MAX_AGENT_ID_LEN,
  MAX_NAME_LEN,
  MAX_URI_LEN,
} from "@/lib/registry";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RevealSection } from "@/components/motion/RevealSection";
import { SuccessCheck } from "@/components/motion/SuccessCheck";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { StrategySelector, STRATEGY_TEMPLATES, StrategyTemplate } from "@/components/create/StrategySelector";
import { FundAndDelegate } from "@/components/create/FundAndDelegate";
import { ArrowRightGlyph } from "@/components/ui/StatusGlyphs";

const BaseConnectButton = dynamicImport(
  () => import("@/components/ui/BaseConnectButton").then((mod) => mod.BaseConnectButton),
  { ssr: false },
);

const WalletMultiButton = dynamicImport(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false },
);

type SubmitState =
  | { status: "idle" }
  | { status: "signing" }
  | { status: "confirmed"; agentPda: string; signature?: string; alreadyExisted?: boolean }
  | { status: "error"; message: string };

const BASE_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_BASE_REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000000";

const registryAbi = [
  {
    inputs: [
      { internalType: "string", name: "agentId", type: "string" },
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "strategyUri", type: "string" },
      { internalType: "address", name: "vaultAddress", type: "address" },
    ],
    name: "registerAgent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export default function CreateAgentPage() {
  const { connection } = useConnection();
  const { publicKey, signMessage } = useWallet();
  const anchorWallet = useAnchorWallet();

  // EVM Hooks
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const [evmTxHash, setEvmTxHash] = useState<`0x${string}` | undefined>(undefined);
  const indexedBaseTx = useRef<string | null>(null);
  const { isLoading: isEvmConfirming, isSuccess: isEvmSuccess, error: evmConfirmError } = useWaitForTransactionReceipt({
    hash: evmTxHash,
  });

  const [activeChain, setActiveChain] = useState<"solana" | "base">("base");
  const [isPaperMode, setIsPaperMode] = useState(false);
  const [simulatedBalance, setSimulatedBalance] = useState(1000);
  const [selectedTemplateId, setSelectedTemplateId] = useState(STRATEGY_TEMPLATES[0].id);
  const [agentId, setAgentId] = useState("momentum-sol-1");
  const [name, setName] = useState("Momentum Bot");
  const [strategyUri, setStrategyUri] = useState(STRATEGY_TEMPLATES[0].strategyUri);
  const [vaultPubkey, setVaultPubkey] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const reduced = useReducedMotion();

  // Backtest params injected from /backtest → "Deploy Agent" redirect
  const [backtestParams, setBacktestParams] = useState<Record<string, number> | null>(null);
  const [fromBacktest, setFromBacktest] = useState(false);

  // Get filtered backtest params based on active strategy type
  const getFilteredBacktestParams = () => {
    if (!backtestParams) return null;
    const filtered: Record<string, number> = {};

    // sizeUsd is always relevant
    if (backtestParams.sizeUsd !== undefined) {
      filtered.sizeUsd = backtestParams.sizeUsd;
    }

    if (selectedTemplateId === "momentum") {
      if (backtestParams.thresholdBps !== undefined) filtered.thresholdBps = backtestParams.thresholdBps;
      if (backtestParams.windowSize !== undefined) filtered.windowSize = backtestParams.windowSize;
    } else if (selectedTemplateId === "mean-reversion") {
      if (backtestParams.windowSize !== undefined) filtered.windowSize = backtestParams.windowSize;
      if (backtestParams.rsiLowerThreshold !== undefined) filtered.rsiLower = backtestParams.rsiLowerThreshold;
      if (backtestParams.rsiUpperThreshold !== undefined) filtered.rsiUpper = backtestParams.rsiUpperThreshold;
    } else if (selectedTemplateId === "grid") {
      if (backtestParams.gridSpacingBps !== undefined) filtered.gridSpacing = backtestParams.gridSpacingBps;
    }

    return filtered;
  };

  const effectiveVault =
    vaultPubkey.trim() ||
    (activeChain === "solana"
      ? publicKey
        ? publicKey.toBase58()
        : ""
      : evmAddress || "");

  // Load and sync network selection & drafts
  useEffect(() => {
    const saved = localStorage.getItem("viperx-active-chain");
    if (saved === "solana" || saved === "base") {
      setActiveChain(saved);
    } else {
      setActiveChain("base");
    }

    // Parse backtest redirect query params (avoids Next.js useSearchParams + Suspense overhead)
    const qp = new URLSearchParams(window.location.search);
    const queryStrategy = qp.get("strategy"); // "momentum" | "grid" | "mean_reversion"

    if (queryStrategy) {
      // Normalise: backtest page emits "mean_reversion"; StrategySelector uses "mean-reversion"
      const templateId = queryStrategy === "mean_reversion" ? "mean-reversion" : queryStrategy;
      const template = STRATEGY_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        setSelectedTemplateId(template.id);
        setStrategyUri(template.strategyUri);
        const rand = Math.floor(1000 + Math.random() * 9000);
        const generatedId = `${templateId}-${rand}`;
        setAgentId(generatedId);
        setName(`${template.name} #${rand}`);

        // Collect numeric tuning params from the URL to display in a post-deploy banner
        const collected: Record<string, number> = {};
        for (const key of ["sizeUsd", "thresholdBps", "windowSize", "gridSpacingBps", "rsiLowerThreshold", "rsiUpperThreshold"]) {
          const v = qp.get(key);
          if (v !== null && !isNaN(Number(v))) collected[key] = Number(v);
        }
        setBacktestParams(collected);
        setFromBacktest(true);
        // Persist so they survive a page reload until the user dismisses
        localStorage.setItem("viperx-backtest-params", JSON.stringify({ strategy: templateId, ...collected }));
        return; // Skip loading stale localStorage drafts when redirected from backtest
      }
    }

    // Restore persisted backtest params if any (e.g. after wallet connect redirect)
    const storedBtParams = localStorage.getItem("viperx-backtest-params");
    if (storedBtParams) {
      try {
        const parsed = JSON.parse(storedBtParams);
        const { strategy: strat, ...rest } = parsed;
        if (strat) {
          const template = STRATEGY_TEMPLATES.find((t) => t.id === strat);
          if (template) {
            setSelectedTemplateId(template.id);
            setStrategyUri(template.strategyUri);
          }
        }
        setBacktestParams(rest);
        setFromBacktest(true);
      } catch { /* ignore */ }
    }

    // Load drafts on mount (only when NOT coming from backtest)
    const savedAgentId = localStorage.getItem("viperx-draft-agentId");
    const savedName = localStorage.getItem("viperx-draft-name");
    const savedStrategyUri = localStorage.getItem("viperx-draft-strategyUri");
    const savedVaultPubkey = localStorage.getItem("viperx-draft-vaultPubkey");
    const savedTemplateId = localStorage.getItem("viperx-draft-templateId");

    if (savedAgentId) setAgentId(savedAgentId);
    if (savedName) setName(savedName);
    if (savedStrategyUri) setStrategyUri(savedStrategyUri);
    if (savedVaultPubkey) setVaultPubkey(savedVaultPubkey);
    if (savedTemplateId) setSelectedTemplateId(savedTemplateId);
  }, []);

  function clearFormDrafts() {
    localStorage.removeItem("viperx-draft-agentId");
    localStorage.removeItem("viperx-draft-name");
    localStorage.removeItem("viperx-draft-strategyUri");
    localStorage.removeItem("viperx-draft-vaultPubkey");
    localStorage.removeItem("viperx-draft-templateId");
    localStorage.removeItem("viperx-backtest-params");
  }

  function handleNameChange(next: string) {
    setName(next);
    localStorage.setItem("viperx-draft-name", next);
  }

  function handleStrategyUriChange(next: string) {
    setStrategyUri(next);
    localStorage.setItem("viperx-draft-strategyUri", next);
  }

  function handleVaultPubkeyChange(next: string) {
    setVaultPubkey(next);
    localStorage.setItem("viperx-draft-vaultPubkey", next);
  }

  useEffect(() => {
    const updateNetwork = () => {
      const saved = localStorage.getItem("viperx-active-chain");
      if (saved === "solana" || saved === "base") {
        setActiveChain(saved);
      }
    };
    window.addEventListener("storage", updateNetwork);
    window.addEventListener("viperx-chain-changed", updateNetwork);
    return () => {
      window.removeEventListener("storage", updateNetwork);
      window.removeEventListener("viperx-chain-changed", updateNetwork);
    };
  }, []);

  // React to EVM transaction confirmations
  useEffect(() => {
    if (!isEvmSuccess || !evmTxHash || activeChain !== "base" || !evmAddress) return;
    if (indexedBaseTx.current === evmTxHash) return;
    indexedBaseTx.current = evmTxHash;
    const pda = baseAgentKey(evmAddress, agentId);
    clearFormDrafts();
    setState({
      status: "confirmed",
      agentPda: pda,
      signature: evmTxHash,
    });
    void indexOnchainBaseAgent({
      agentId,
      name,
      strategyUri,
      ownerAddress: evmAddress,
      vaultAddress: effectiveVault,
      txHash: evmTxHash,
    }).catch((err) => {
      console.error("Failed to index Base agent into leaderboard-api:", err);
    });
  }, [isEvmSuccess, evmTxHash, activeChain, evmAddress, agentId, name, strategyUri, effectiveVault]);

  useEffect(() => {
    if (evmConfirmError && activeChain === "base") {
      setState({ status: "error", message: sanitizeErrorMessage(evmConfirmError) });
    }
  }, [evmConfirmError, activeChain]);

  const errors: string[] = [];
  if (agentId.length > MAX_AGENT_ID_LEN) errors.push(`agent_id must be ${MAX_AGENT_ID_LEN} bytes or fewer`);
  if (name.length > MAX_NAME_LEN) errors.push(`name must be ${MAX_NAME_LEN} bytes or fewer`);
  if (strategyUri.length > MAX_URI_LEN) errors.push(`strategy_uri must be ${MAX_URI_LEN} bytes or fewer`);
  
  let vaultPubkeyParsed: PublicKey | null = null;
  let isEvmAddressValid = false;

  if (activeChain === "solana") {
    if (effectiveVault) {
      try {
        vaultPubkeyParsed = new PublicKey(effectiveVault);
      } catch {
        errors.push("vault pubkey is not a valid Solana address");
      }
    }
  } else {
    isEvmAddressValid = /^0x[a-fA-F0-9]{40}$/.test(effectiveVault);
    if (effectiveVault && !isEvmAddressValid) {
      errors.push("vault address is not a valid EVM address");
    }
  }

  const canSubmit = isPaperMode
    ? (activeChain === "solana"
        ? !!publicKey && !!signMessage && agentId.length > 0 && name.length > 0 && errors.length === 0
        : !!evmAddress && !!signMessageAsync && agentId.length > 0 && name.length > 0 && errors.length === 0)
    : (activeChain === "solana"
        ? !!anchorWallet && !!publicKey && agentId.length > 0 && name.length > 0 && !!vaultPubkeyParsed && errors.length === 0
        : isEvmConnected && !!evmAddress && agentId.length > 0 && name.length > 0 && isEvmAddressValid && errors.length === 0);

  function handleAgentIdChange(next: string) {
    setAgentId(next);
    localStorage.setItem("viperx-draft-agentId", next);
    if (state.status !== "signing") {
      setState({ status: "idle" });
    }
  }

  function handleNetworkChange(chain: "solana" | "base") {
    setActiveChain(chain);
    localStorage.setItem("viperx-active-chain", chain);
    window.dispatchEvent(new Event("viperx-chain-changed"));
    window.dispatchEvent(new Event("storage"));
    setState({ status: "idle" });
    setEvmTxHash(undefined);
  }

  // Pre-flight check for Solana agent already registered
  useEffect(() => {
    if (activeChain !== "solana") return;
    if (!publicKey || !anchorWallet || !agentId || agentId.length > MAX_AGENT_ID_LEN) return;
    if (state.status === "signing" || state.status === "confirmed") return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const pda = getAgentPda(publicKey, agentId);
        const info = await connection.getAccountInfo(pda);
        if (cancelled || !info || info.data.length !== AGENT_SPACE) return;

        const program = getRegistryProgram(connection, anchorWallet);
        const agent = await program.account.agent.fetch(pda);
        if (!cancelled && agent.owner.equals(publicKey)) {
          setState({ status: "confirmed", agentPda: pda.toBase58(), alreadyExisted: true });
        }
      } catch {
        // Not registered yet
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [publicKey, anchorWallet, agentId, connection, state.status, activeChain]);

  function handleSelectTemplate(template: StrategyTemplate) {
    setSelectedTemplateId(template.id);
    localStorage.setItem("viperx-draft-templateId", template.id);

    setStrategyUri(template.strategyUri);
    localStorage.setItem("viperx-draft-strategyUri", template.strategyUri);

    if (!name || name === "Momentum Bot" || name === "RSI Mean Reversion" || name === "Grid Trading Bot" || name === "Automated Grid Trading") {
      setName(template.name);
      localStorage.setItem("viperx-draft-name", template.name);
    }
    if (!agentId || agentId.startsWith("momentum-") || agentId.startsWith("rsi-") || agentId.startsWith("grid-")) {
      handleAgentIdChange(`${template.id}-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ── Paper Mode path (no on-chain TX) ────────────────────────────────────
    if (isPaperMode) {
      setState({ status: "signing" });
      try {
        const nonce = Date.now().toString();
        const message = `viperx-register-paper-agent:${agentId}:${nonce}`;
        let signature = "";
        let ownerAddress = "";

        if (activeChain === "solana") {
          if (!publicKey || !signMessage) return;
          ownerAddress = publicKey.toBase58();
          const msgBytes = new TextEncoder().encode(message);
          const sigBytes = await signMessage(msgBytes);
          signature = bs58.encode(sigBytes);
        } else {
          if (!evmAddress) return;
          ownerAddress = evmAddress;
          signature = await signMessageAsync({ message });
        }

        const result = await registerPaperAgent({
          agentId,
          name,
          strategyUri,
          ownerAddress,
          chain: activeChain,
          simulatedBalance,
          nonce,
          signature,
        });

        clearFormDrafts();
        setState({ status: "confirmed", agentPda: result.agentPda });
      } catch (err) {
        setState({ status: "error", message: sanitizeErrorMessage(err) });
      }
      return;
    }

    // ── Solana Devnet path ───────────────────────────────────────────────────
    if (activeChain === "solana") {
      if (!anchorWallet || !publicKey || !vaultPubkeyParsed) return;

      setState({ status: "signing" });
      try {
        const program = getRegistryProgram(connection, anchorWallet);
        const agentPda = getAgentPda(publicKey, agentId);

        const signature = await program.methods
          .registerAgent(agentId, name, strategyUri, vaultPubkeyParsed)
          .accounts({
            owner: publicKey,
            agent: agentPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        clearFormDrafts();
        setState({ status: "confirmed", agentPda: agentPda.toBase58(), signature });
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : "";

        if (rawMessage.includes("already in use")) {
          try {
            const agentPda = getAgentPda(publicKey, agentId);
            const program = getRegistryProgram(connection, anchorWallet);
            const agent = await program.account.agent.fetch(agentPda);
            if (agent.owner.equals(publicKey)) {
              setState({ status: "confirmed", agentPda: agentPda.toBase58(), alreadyExisted: true });
              return;
            }
          } catch {
            // fall through
          }
        }

        setState({ status: "error", message: sanitizeErrorMessage(err) });
      }
    } else {
    // ── Base Sepolia path ────────────────────────────────────────────────────
      if (!isEvmConnected || !evmAddress) return;

      setState({ status: "signing" });
      setEvmTxHash(undefined);
      try {
        const txHash = await writeContractAsync({
          address: BASE_REGISTRY_ADDRESS as `0x${string}`,
          abi: registryAbi,
          functionName: "registerAgent",
          args: [agentId, name, strategyUri, effectiveVault as `0x${string}`],
        });
        setEvmTxHash(txHash);
      } catch (err) {
        setState({
          status: "error",
          message: sanitizeErrorMessage(err),
        });
      }
    }
  }

  return (
    <Section className="pt-20 pb-24 sm:pt-24">
      <div className="mb-10">
        <span className="t-label">Deploy</span>
        <h1 className="t-h2 mt-3 text-foreground">Register an agent</h1>
        <p className="t-body mt-2 max-w-[54ch] text-sm">
          Pick a strategy engine, name your agent, and sign one transaction. Nothing
          is custodied by this app.
        </p>
      </div>

      {/* --- Backtest redirect banner ---------------------------------------- */}
      {fromBacktest && backtestParams && (
        <div className="mb-8 flex items-start gap-4 rounded-xl border border-border bg-surface px-5 py-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-foreground-muted">
              <path d="M8 1.5A6.5 6.5 0 1 0 14.5 8 6.508 6.508 0 0 0 8 1.5Zm.75 9.25a.75.75 0 0 1-1.5 0V7a.75.75 0 0 1 1.5 0Zm-.75-5a.875.875 0 1 1 0 1.75.875.875 0 0 1 0-1.75Z" fill="currentColor"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-mono text-xs font-semibold text-foreground">Prefilled from Backtest Lab</p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Strategy template and parameters have been auto-selected from your last backtest run.
              You can still modify any field below.
            </p>
            {(() => {
              const filtered = getFilteredBacktestParams();
              if (!filtered || Object.keys(filtered).length === 0) return null;
              return (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(filtered).map(([k, v]) => (
                    <span key={k} className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-foreground-muted">
                      {k}: <span className="text-foreground">{v}</span>
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
          <button
            type="button"
            onClick={() => { setFromBacktest(false); localStorage.removeItem("viperx-backtest-params"); }}
            className="shrink-0 text-foreground-faint hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* --- Chain Selector Tab ------------------------------------------- */}
      <div className="mb-8 border-b border-border pb-6">
        <label className="t-label block mb-3">1. Select Network</label>
        <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl w-fit">
          <button
            type="button"
            onClick={() => handleNetworkChange("base")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold cursor-pointer transition-all ${
              activeChain === "base"
                ? "bg-foreground text-background shadow"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            Base Sepolia
          </button>
          <button
            type="button"
            onClick={() => handleNetworkChange("solana")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold cursor-pointer transition-all ${
              activeChain === "solana"
                ? "bg-foreground text-background shadow"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            Solana Devnet
          </button>
        </div>
      </div>

      {/* --- Execution Mode ------------------------------------------------ */}
      <div className="mb-8 border-b border-border pb-6">
        <label className="t-label block mb-3">Execution mode</label>
        <div className="surface flex flex-col gap-4 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-sm font-semibold text-foreground">
                {isPaperMode
                  ? "Paper registration"
                  : activeChain === "base"
                    ? "Live Base Sepolia registration"
                    : "Live Solana devnet registration"}
              </p>
              <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-foreground-muted">
                {isPaperMode
                  ? "Use simulated capital for a fast demo run. Paper agents stay separate from verified PnL, rankings, and reputation."
                  : "Register on-chain with your wallet. The app never receives custody or withdrawal authority."}
              </p>
            </div>

            <div className="grid w-full grid-cols-2 rounded-full border border-border bg-background p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setIsPaperMode(false)}
                className={`rounded-full px-4 py-2 font-mono text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  !isPaperMode
                    ? "bg-foreground text-background"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Live
              </button>
              <button
                type="button"
                onClick={() => setIsPaperMode(true)}
                className={`rounded-full px-4 py-2 font-mono text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  isPaperMode
                    ? "bg-foreground text-background"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Paper
              </button>
            </div>
          </div>

          {isPaperMode && (
            <div className="border-t border-border pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="t-label">Simulated starting balance</span>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Demo-only capital. No transaction is submitted.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[500, 1000, 5000, 10000].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSimulatedBalance(b)}
                      className={`rounded-full border px-3 py-1.5 font-mono text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        simulatedBalance === b
                          ? "border-accent bg-accent-fill text-white"
                          : "border-border bg-background text-foreground-muted hover:border-border-strong hover:text-foreground"
                      }`}
                    >
                      ${b.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single wallet connect hint — only shown if the relevant wallet isn't yet connected */}
      {((activeChain === "solana" && !publicKey) ||
        (activeChain === "base" && !isEvmConnected)) && (
        <Card variant="muted" className="mb-8 text-left flex items-center justify-between gap-4">
          <span className="text-sm text-foreground-muted">
            {activeChain === "solana"
              ? isPaperMode
                ? "Connect a Solana wallet to sign the paper registration. No on-chain TX required."
                : <>Connect a devnet wallet to register an agent via <code className="font-mono">register_agent</code>. You sign — nothing is custodied by this app.</>
              : isPaperMode
              ? "Connect a Base wallet to sign the paper registration. No on-chain TX required."
              : "Connect a Base Sepolia wallet to register on the EVM registry contract."}
          </span>
          {activeChain === "solana" ? <WalletMultiButton /> : <BaseConnectButton />}
        </Card>
      )}

      {/* --- Strategy Selector Preset Cards -------------------------------- */}
      <div className="mb-8">
        <label className="t-label block mb-3">
          2. Select Strategy Engine
        </label>
        <StrategySelector selectedId={selectedTemplateId} onSelect={handleSelectTemplate} />
      </div>

      <RevealSection>
        <label className="t-label block mb-3">
          3. Configure Agent Parameters
        </label>

        <form onSubmit={handleSubmit} className="surface flex flex-col gap-5 rounded-xl p-6">
          <Field
            label="Agent ID"
            hint={`Unique per your wallet, immutable, up to ${MAX_AGENT_ID_LEN} bytes.`}
            value={agentId}
            onChange={handleAgentIdChange}
            placeholder="momentum-sol-1"
          />
          <Field
            label="Name"
            hint={`Display name, up to ${MAX_NAME_LEN} bytes.`}
            value={name}
            onChange={handleNameChange}
            placeholder="Momentum Bot"
          />
          <Field
            label="Strategy URI"
            hint={`Off-chain strategy metadata link, up to ${MAX_URI_LEN} bytes.`}
            value={strategyUri}
            onChange={handleStrategyUriChange}
            placeholder="https://example.com/strategy.json"
          />
          {!isPaperMode && (
            <Field
              label={activeChain === "solana" ? "Vault Pubkey (optional)" : "Vault Address (optional)"}
              hint={activeChain === "solana"
                ? "Owner pubkey that holds collateral. Leave blank to default to your connected wallet."
                : "Owner address that holds collateral. Leave blank to default to your connected EVM wallet."
              }
              value={vaultPubkey}
              onChange={handleVaultPubkeyChange}
              placeholder={activeChain === "solana"
                ? (publicKey ? publicKey.toBase58() : "Connected wallet")
                : (evmAddress || "Connected EVM wallet")
              }
            />
          )}

          {errors.length > 0 && (
            <Card variant="error">
              <ul className="list-disc pl-4 text-xs">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </Card>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {state.status === "error" && (
              <ResultTransition reduced={reduced} key="error">
                <Card variant="error">Registration failed: {state.message}</Card>
              </ResultTransition>
            )}

            {state.status === "confirmed" && state.alreadyExisted && (
              <ResultTransition reduced={reduced} key="already-existed">
                <Card variant="muted" className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="font-mono text-lg font-medium text-foreground">
                    Agent Already Registered
                  </div>
                  <p className="max-w-md text-xs text-foreground-muted">
                    This wallet already has an agent registered under agent ID{" "}
                    <code className="font-mono">{agentId}</code>: no need to register again.
                    Continue funding and delegating it below.
                  </p>
                  <div className="flex gap-3">
                    <Button href={`/agents/${state.agentPda}`}>View Agent Profile</Button>
                    <Button href="/leaderboard" variant="secondary">
                      View Leaderboard
                    </Button>
                  </div>
                </Card>
              </ResultTransition>
            )}

            {state.status === "confirmed" && !state.alreadyExisted && (
              <ResultTransition reduced={reduced} key="registered">
                <Card variant="success" className="flex flex-col items-center gap-3 py-6 text-center">
                  <SuccessCheck className="h-12 w-12" />
                  <div className="font-mono text-lg font-medium text-foreground">
                    Agent Registered On-Chain!
                  </div>
                  <p className="max-w-md text-xs text-foreground-muted">
                    Transaction confirmed on {activeChain === "solana" ? "Solana devnet" : "Base Sepolia"}. Your agent account is live and indexing.
                  </p>
                  <div className="flex gap-3">
                    <Button href={`/agents/${state.agentPda}`}>View Agent Profile</Button>
                    <Button href="/leaderboard" variant="secondary">
                      View Leaderboard
                    </Button>
                  </div>
                </Card>
              </ResultTransition>
            )}
          </AnimatePresence>

          {state.status === "confirmed" && activeChain === "solana" && (
            <FundAndDelegate agentPda={state.agentPda} />
          )}

          {state.status === "confirmed" && activeChain === "base" && (
            <Card variant="muted" className="mt-6 flex flex-col gap-3 text-left">
              <h3 className="font-mono text-sm font-semibold text-foreground">
                EVM Agent Configuration Completed
              </h3>
              <p className="text-xs text-foreground-muted">
                Your agent is registered on Base Sepolia as its own identity (owner + agent ID). The runtime can trade against the vault you set; withdrawal rights stay in your wallet.
              </p>
            </Card>
          )}

          {state.status !== "confirmed" && (
            <Button
              type="submit"
              disabled={!canSubmit || state.status === "signing" || (!isPaperMode && activeChain === "base" && isEvmConfirming)}
              className="mt-2 justify-center py-3"
            >
              {state.status === "signing" ? (
                isPaperMode ? "Signing paper registration..." : "Signing transaction..."
              ) : !isPaperMode && activeChain === "base" && isEvmConfirming ? (
                "Confirming on Base Sepolia..."
              ) : (
                <>
                  <ArrowRightGlyph />
                  {isPaperMode
                    ? "Register Paper Agent (No TX)"
                    : activeChain === "solana"
                    ? "Register Agent on Solana Devnet"
                    : "Register Agent on Base Sepolia"}
                </>
              )}
            </Button>
          )}
        </form>
      </RevealSection>
    </Section>
  );
}

function ResultTransition({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block font-mono text-xs font-medium text-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2 font-mono text-xs text-foreground placeholder:text-foreground-faint focus:border-accent focus:outline-none"
      />
      <p className="mt-1 text-[11px] text-foreground-muted">{hint}</p>
    </div>
  );
}

function sanitizeErrorMessage(err: unknown): string {
  if (!err) return "An unknown error occurred.";
  
  const msg = err instanceof Error ? err.message : String(err);
  
  // Clean up standard Web3 / EVM rejection signatures
  if (msg.includes("User rejected the request") || msg.includes("User rejected the transaction")) {
    return "Transaction request was cancelled by the user.";
  }
  
  // Clean up Solana wallet rejections
  if (msg.includes("User rejected the signature request") || msg.includes("Signature request denied")) {
    return "Signature request was cancelled by the user.";
  }

  // Check if it's a Viem/Wagmi error with shortMessage
  if (err instanceof Error && "shortMessage" in err && typeof err.shortMessage === "string") {
    return err.shortMessage;
  }
  
  // Fallback cleanup if the message contains the long Viem stack trace
  if (msg.includes("Request Arguments:") || msg.includes("Contract Call:")) {
    const firstLine = msg.split("\n")[0];
    return firstLine.replace("Registration failed: ", "");
  }

  return msg;
}
