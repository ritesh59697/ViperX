import { Section } from "@/components/ui/Section";
import { GridLoader } from "@/components/ui/GridLoader";

export default function LoadingAgentProfile() {
  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      {/* Top Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 font-mono text-xs text-foreground-faint">
        <span>Leaderboard</span>
        <span>/</span>
        <span className="text-accent animate-pulse">Telemetry Stream</span>
      </div>

      <div className="w-full flex flex-col gap-6 sm:gap-8 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl border border-border/70 shadow-2xl relative overflow-hidden">
        {/* Glowing Laser Scanner Beam */}
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-surface border border-border/40">
          <div className="absolute inset-y-0 h-full w-48 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent animate-laser-beam blur-[1px]" />
          <div className="absolute inset-y-0 h-full w-32 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent animate-laser-beam" />
        </div>

        {/* Captivating Cybernetic Telemetry Status Banner */}
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* 3x2 Blinking Grid Loader */}
            <div className="shrink-0 flex items-center justify-center">
              <GridLoader size={42} />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                  Syncing Quantitative Telemetry
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-positive bg-positive/10 border border-positive/30 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
                  INDEXER ACTIVE
                </span>
              </div>
              <p className="font-mono text-[11px] sm:text-xs text-foreground-muted leading-relaxed">
                Querying verified on-chain fills, computing Sharpe distribution, and reconstructing parameter change log...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-foreground-faint">
            <span className="px-2.5 py-1 rounded bg-surface border border-border">
              Base & Solana
            </span>
            <span className="px-2.5 py-1 rounded bg-surface border border-border text-accent">
              50+ Fills Bar
            </span>
          </div>
        </div>

        {/* Header Skeleton */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-44 sm:w-64 rounded-lg bg-surface/80 animate-pulse border border-border/40" />
              <div className="h-5 w-24 rounded-full bg-accent/20 animate-pulse border border-accent/30" />
            </div>
            <div className="h-3.5 w-36 rounded bg-surface/50 animate-pulse font-mono text-xs text-foreground-faint">
              agent.pda · loading...
            </div>
          </div>
          <div className="flex gap-3">
            <div className="h-9 w-28 rounded-lg bg-surface/80 animate-pulse border border-border/40" />
            <div className="h-9 w-32 rounded-lg bg-accent/20 animate-pulse border border-accent/40" />
          </div>
        </div>

        {/* 8 Quantitative Metric Tiles Skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { label: "ROI (Realized)", hint: "Volatility scaled" },
            { label: "Sharpe-like", hint: "Risk adjusted" },
            { label: "Max Drawdown", hint: "Peak to trough" },
            { label: "Realized PNL", hint: "Closed trades" },
            { label: "Verified Fills", hint: "On-chain proved" },
            { label: "Vault Balance", hint: "Non-custodial" },
            { label: "Active Copiers", hint: "Mirroring agent" },
            { label: "Anti-Gaming", hint: "Clean execution" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface/40 p-4 relative overflow-hidden"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">
                {item.label}
              </span>
              <div className="h-6 w-20 rounded bg-surface/80 animate-pulse" />
              <span className="font-mono text-[9px] text-foreground-muted opacity-60">
                {item.hint}
              </span>
            </div>
          ))}
        </div>

        {/* Oscilloscope Waveform Chart Simulator */}
        <div className="rounded-xl border border-border/60 bg-surface/30 p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
              <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
                Performance Trajectory (PNL History)
              </span>
            </div>
            <div className="h-6 w-36 rounded-md bg-surface/60 animate-pulse" />
          </div>

          {/* SVG Waveform Simulation */}
          <div className="relative h-52 w-full rounded-lg bg-surface/20 border border-border/30 overflow-hidden flex flex-col justify-end p-4">
            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_24px]" />
            
            {/* Pulsing Oscilloscope Waveform */}
            <svg viewBox="0 0 800 160" className="w-full h-32 relative z-10 stroke-accent fill-none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent, #3b82f6)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-accent, #3b82f6)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,110 Q120,40 240,80 T480,50 T640,90 T800,30"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="opacity-75 animate-pulse"
              />
              <path
                d="M0,110 Q120,40 240,80 T480,50 T640,90 T800,30 L800,160 L0,160 Z"
                fill="url(#chartGradient)"
              />
            </svg>

            {/* Bottom status badge over chart */}
            <div className="relative z-10 flex items-center justify-between font-mono text-[10px] text-foreground-faint pt-2 border-t border-border/30">
              <span>Streaming 200 PnL snapshots</span>
              <span className="text-accent animate-pulse">Calculating drawdown envelope...</span>
            </div>
          </div>
        </div>

        {/* Live Verification Checkpoints */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="rounded-lg border border-border/40 bg-surface/30 p-3 flex items-center gap-2 text-foreground-muted">
            <span className="text-positive font-bold">✓</span>
            <span className="truncate">Vault Authority Authenticated</span>
          </div>
          <div className="rounded-lg border border-border/40 bg-surface/30 p-3 flex items-center gap-2 text-foreground-muted">
            <span className="text-positive font-bold">✓</span>
            <span className="truncate">Index Receipts Confirmed</span>
          </div>
          <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 flex items-center gap-2 text-accent">
            <div className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
            <span className="truncate">Evaluating Anti-Gaming Logs</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

