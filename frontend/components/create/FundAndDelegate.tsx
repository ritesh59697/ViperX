"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useVelocity } from "@/hooks/useVelocity";
import { getRegistryProgram, RUNTIME_PUBKEY } from "@/lib/registry";
import { Button } from "@/components/ui/Button";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { CheckGlyph } from "@/components/ui/StatusGlyphs";

type AuthorityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "signing" }
  | { status: "confirmed"; signature?: string }
  | { status: "error"; message: string };

/**
 * Post-registration flow: initialize a Velocity account, deposit SOL
 * collateral, delegate trading rights to the execution runtime (Velocity's
 * own `updateUserDelegate`), and separately authorize that same runtime key
 * on the registry (`set_authority`) so it can call `record_trade` /
 * `authority_pause`. Two different programs, two different delegations —
 * both are needed before the runtime can actually manage this agent.
 *
 * Step "done" states read real on-chain fields (`userAccount.totalDeposits`,
 * `userAccount.delegate`, the registry's `agent.authority`) rather than the
 * last action's transient status — `useVelocity`'s `txState` reflects only
 * whichever action ran most recently, so gating on it would make an earlier
 * step's checkmark disappear the moment a later step's transaction lands.
 */
export function FundAndDelegate({ agentPda }: { agentPda: string }) {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const {
    isLoading,
    isInitialized,
    userAccount,
    txState,
    initializeUserAccount,
    depositSolCollateral,
    delegateToRuntime,
  } = useVelocity();

  const [depositAmount, setDepositAmount] = useState("1");
  const [authorityState, setAuthorityState] = useState<AuthorityState>({ status: "idle" });

  const hasDeposited = Boolean(userAccount && !userAccount.totalDeposits.isZero());
  const isDelegated = Boolean(
    userAccount && RUNTIME_PUBKEY && userAccount.delegate.equals(RUNTIME_PUBKEY)
  );

  // Check whether the registry authority was already set (e.g. a previous
  // visit, or a page reload after signing) rather than only trusting this
  // session's own transaction state.
  useEffect(() => {
    const runtimePubkey = RUNTIME_PUBKEY;
    if (!anchorWallet || !runtimePubkey) return;
    let cancelled = false;
    getRegistryProgram(connection, anchorWallet)
      .account.agent.fetch(new PublicKey(agentPda))
      .then((agent) => {
        if (cancelled) return;
        setAuthorityState(
          agent.authority.equals(runtimePubkey)
            ? { status: "confirmed" }
            : { status: "idle" }
        );
      })
      .catch(() => {
        if (!cancelled) setAuthorityState({ status: "idle" });
      });
    return () => {
      cancelled = true;
    };
  }, [connection, anchorWallet, agentPda]);

  async function handleAuthorizeRuntime() {
    if (!anchorWallet || !RUNTIME_PUBKEY) return;
    setAuthorityState({ status: "signing" });
    try {
      const program = getRegistryProgram(connection, anchorWallet);
      const signature = await program.methods
        .setAuthority(RUNTIME_PUBKEY)
        .accounts({ owner: anchorWallet.publicKey, agent: new PublicKey(agentPda) })
        .rpc();
      setAuthorityState({ status: "confirmed", signature });
    } catch (err) {
      setAuthorityState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to set registry authority.",
      });
    }
  }

  if (!anchorWallet) {
    return (
      <div className="mt-6 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
        <div className="rounded-lg bg-white p-4 text-left text-xs text-foreground-muted dark:bg-[#0a0a0a]">
          Reconnect your wallet to fund and delegate this agent&apos;s trading vault.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
      <div className="flex flex-col gap-5 rounded-lg bg-white p-5 text-left dark:bg-[#0a0a0a]">
        <div>
          <h3 className="font-mono text-sm font-semibold text-foreground">
            3. Fund &amp; Delegate Trading Vault
          </h3>
          <p className="mt-1 text-xs text-foreground-muted">
            Your agent is registered, but the execution runtime can&apos;t trade it yet. Four steps,
            each a separate signature: you stay in control of withdrawals the whole time.
          </p>
        </div>

        <Step
          label="Initialize Velocity account"
          done={isInitialized}
          disabled={isInitialized || isLoading}
          loading={txState.action === "init" && txState.status === "signing"}
          onClick={initializeUserAccount}
          buttonLabel="Initialize"
        >
          Creates your devnet Velocity sub-account (subAccount 0): the account collateral gets
          deposited into.
        </Step>

        <Step
          label="Deposit SOL collateral"
          done={hasDeposited}
          disabled={!isInitialized || isLoading}
          loading={txState.action === "deposit" && txState.status === "signing"}
          onClick={() => depositSolCollateral(depositAmount)}
          buttonLabel="Deposit"
          input={
            <input
              type="text"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              disabled={!isInitialized}
              className="w-20 rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-accent focus:outline-none disabled:opacity-40"
            />
          }
        >
          SOL deposited as collateral your agent trades against on devnet.
        </Step>

        <Step
          label="Delegate trading to runtime"
          done={isDelegated}
          disabled={!isInitialized || isLoading || !RUNTIME_PUBKEY}
          loading={txState.action === "delegate" && txState.status === "signing"}
          onClick={() => RUNTIME_PUBKEY && delegateToRuntime(RUNTIME_PUBKEY)}
          buttonLabel="Delegate"
        >
          {RUNTIME_PUBKEY ? (
            <>
              Lets the runtime (<code className="font-mono">{shorten(RUNTIME_PUBKEY.toBase58())}</code>) open
              and close positions on your vault: it can never withdraw.
            </>
          ) : (
            <span className="text-negative">
              Runtime pubkey not configured (NEXT_PUBLIC_RUNTIME_PUBKEY): ask the operator.
            </span>
          )}
        </Step>

        <Step
          label="Authorize runtime for record_trade"
          done={authorityState.status === "confirmed"}
          disabled={!RUNTIME_PUBKEY || authorityState.status === "signing"}
          loading={authorityState.status === "signing"}
          onClick={handleAuthorizeRuntime}
          buttonLabel="Authorize"
        >
          A separate, on-chain-registry-only delegation (<code className="font-mono">set_authority</code>):
          lets the runtime bump your agent&apos;s trade count and pause it on repeated failures.
          Can&apos;t retire, edit, or touch funds.
        </Step>

        <AnimatePresence>
          {txState.status === "error" && (
            <ErrorCardTransition key="tx-error">{txState.error}</ErrorCardTransition>
          )}
          {authorityState.status === "error" && (
            <ErrorCardTransition key="authority-error">{authorityState.message}</ErrorCardTransition>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ErrorCardTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className="rounded-lg border border-negative/30 bg-negative/10 p-3 text-xs text-negative">
        {children}
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -8 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
    >
      <div className="rounded-lg border border-negative/30 bg-negative/10 p-3 text-xs text-negative">
        {children}
      </div>
    </motion.div>
  );
}

function shorten(pubkey: string): string {
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
}

function Step({
  label,
  done,
  disabled,
  loading,
  onClick,
  buttonLabel,
  input,
  children,
}: {
  label: string;
  done: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  buttonLabel: string;
  input?: React.ReactNode;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="flex items-start justify-between gap-4 border-t border-border pt-4 first:border-t-0 first:pt-0"
      animate={done && !reduced ? { backgroundColor: ["rgba(15,157,105,0.08)", "rgba(15,157,105,0)"] } : undefined}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      <div className="flex-1">
        <p className="font-mono text-xs font-medium text-foreground">
          <AnimatePresence mode="popLayout" initial={false}>
            {done && (
              <motion.span
                key="check"
                className="mr-1 inline-flex text-positive"
                initial={reduced ? false : { scale: 0.3, opacity: 0, rotate: -45 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
              >
                <CheckGlyph className="h-3.5 w-3.5" />
              </motion.span>
            )}
          </AnimatePresence>
          {label}
        </p>
        <p className="mt-1 text-[11px] text-foreground-muted">{children}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {input}
        <Button
          type="button"
          variant={done ? "secondary" : "primary"}
          disabled={disabled || done}
          onClick={onClick}
          className="py-1.5 text-xs"
        >
          {done ? "Done" : loading ? "Signing..." : buttonLabel}
        </Button>
      </div>
    </motion.div>
  );
}
