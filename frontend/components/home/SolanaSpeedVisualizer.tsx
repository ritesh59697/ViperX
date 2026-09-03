"use client";

import { motion } from "motion/react";
import { SolanaLogo } from "@/components/ui/SolanaLogo";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { LivePulse } from "@/components/motion/LivePulse";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { AmbientWash } from "@/components/ui/AmbientWash";

export function SolanaSpeedVisualizer() {
  const reduced = useReducedMotion();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-background-elevated p-8 sm:p-12 shadow-2xl">
      <AmbientWash
        src="/5.jpg"
        mask="radial"
        opacity={0.22}
        sizes="420px"
        className="-right-24 -top-24 h-[420px] w-[420px]"
      />
      {/* Background Animated Solana Gradient Blob */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-[380px] w-[380px] rounded-full bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 blur-3xl" />

      <div className="relative z-10 grid gap-10 md:grid-cols-2 items-center">
        {/* Left Col: Text */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#14F195]/30 bg-[#14F195]/10 px-3.5 py-1 text-xs font-mono font-semibold text-[#14F195]">
            <SolanaLogo className="h-3.5 w-3.5" />
            POWERED BY SOLANA HIGH-PERFORMANCE L1
          </div>

          <SplitReveal
            as="h2"
            text="Sub-second execution. Sub-penny fees."
            className="font-serif text-3xl sm:text-4xl font-semibold text-foreground leading-tight"
          />

          <p className="text-sm text-foreground-muted leading-relaxed">
            By leveraging Solana&apos;s 400ms blocktimes and low-latency Sealevel execution runtime, ViperX AI agents submit on-chain trades instantly without gas bottlenecks.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2 font-mono">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="text-2xl font-bold text-[#14F195]">&lt; 400ms</div>
              <div className="mt-1 text-[11px] text-foreground-faint uppercase">Slot Finality</div>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="text-2xl font-bold text-[#9945FF]">~$0.000005</div>
              <div className="mt-1 text-[11px] text-foreground-faint uppercase">Avg Transaction Fee</div>
            </div>
          </div>
        </div>

        {/* Right Col: Animated Solana Architecture Visualizer */}
        <div className="relative flex flex-col items-center justify-center rounded-2xl border border-border bg-background p-6 shadow-inner">
          <motion.div
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-2xl border border-dashed border-[#14F195]/30 pointer-events-none"
          />

          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-1 shadow-[0_0_40px_rgba(20,241,149,0.3)] mb-6">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
              <SolanaLogo className="h-10 w-10" />
            </div>
          </div>

          <div className="w-full space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between rounded-lg border border-border bg-background-elevated px-4 py-2.5">
              <span className="text-foreground-muted">Solana Cluster</span>
              <span className="flex items-center gap-1.5 font-semibold text-positive">
                <LivePulse />
                Devnet (v1.18)
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-background-elevated px-4 py-2.5">
              <span className="text-foreground-muted">Program ID</span>
              <span className="text-foreground font-medium text-[11px]">321hJ...VRm</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-background-elevated px-4 py-2.5">
              <span className="text-foreground-muted">State Storage</span>
              <span className="text-accent font-semibold">Account PDAs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
