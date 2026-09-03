"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAccount, useSignMessage } from "wagmi";
import bs58 from "bs58";
import { transitionPaperAgent } from "@/lib/leaderboardApi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowRightGlyph, CheckGlyph } from "@/components/ui/StatusGlyphs";

interface Props {
  agentPda: string;
  chain: string;
}

export function TransitionToDevnetPanel({ agentPda, chain }: Props) {
  const { publicKey, signMessage } = useWallet();
  const { address: evmAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [vaultPubkey, setVaultPubkey] = useState("");
  const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const ownerAddress = chain === "solana" ? publicKey?.toBase58() : evmAddress;
  const canTransition = !!ownerAddress && vaultPubkey.trim().length > 0 && status === "idle";

  async function handleTransition() {
    if (!ownerAddress) return;
    setStatus("signing");
    setErrorMsg("");
    try {
      const nonce = Date.now().toString();
      const message = `viperx-transition-agent:${agentPda}:${nonce}`;
      let signature = "";

      if (chain === "solana") {
        if (!publicKey || !signMessage) throw new Error("Solana wallet not connected");
        const msgBytes = new TextEncoder().encode(message);
        const sigBytes = await signMessage(msgBytes);
        signature = bs58.encode(sigBytes);
      } else {
        signature = await signMessageAsync({ message });
      }

      await transitionPaperAgent(agentPda, { vaultPubkey: vaultPubkey.trim(), nonce, signature });
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Transition failed");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <Card variant="success" className="mt-8 flex flex-col gap-2">
        <p className="inline-flex items-center gap-2 font-mono font-semibold text-sm text-positive">
          <CheckGlyph />
          Agent transitioned to Devnet!
        </p>
        <p className="text-xs text-foreground-muted">
          Paper trade history is preserved on this profile. A fresh Devnet performance track has started.
          Reload the page to see the updated status.
        </p>
        <Button onClick={() => window.location.reload()} className="mt-2 w-fit py-1 px-3 text-xs">
          Reload
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="mb-4">
        <h3 className="font-mono text-sm font-semibold text-foreground">Transition to Devnet</h3>
        <p className="mt-1 text-xs text-foreground-muted">
          Move this paper agent to live Devnet trading. Your paper trade history is permanently preserved
          here but will never contribute to leaderboard rankings or verified PnL. A fresh Devnet
          performance track will start from zero.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">
            {chain === "solana" ? "Devnet Vault Pubkey" : "Devnet Vault Address"}
          </span>
          <input
            type="text"
            value={vaultPubkey}
            onChange={(e) => setVaultPubkey(e.target.value)}
            placeholder={chain === "solana" ? "Enter your devnet vault pubkey..." : "0x..."}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-foreground/40 transition-colors"
          />
        </label>

        {!ownerAddress && (
          <p className="text-xs text-amber-500">Connect your wallet to proceed.</p>
        )}

        {status === "error" && (
          <p className="text-xs text-negative">{errorMsg}</p>
        )}

        <Button
          onClick={handleTransition}
          disabled={!canTransition}
          className="w-fit py-2 px-4 text-xs"
        >
          {status === "signing" ? (
            "Signing..."
          ) : (
            <>
              <ArrowRightGlyph />
              Transition to Devnet
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
