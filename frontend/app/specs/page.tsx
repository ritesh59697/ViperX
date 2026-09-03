import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Section } from "@/components/ui/Section";
import { RobotLogo } from "@/components/ui/RobotLogo";
import { ExternalLinkGlyph } from "@/components/ui/StatusGlyphs";

export const metadata = {
  title: "System Specs & Network Verification | ViperX",
  description: "Technical specifications, smart contract deployments, indexer synchronization status, and verification heuristics for the ViperX Evaluation Arena.",
};

const CONTRACTS = [
  {
    chain: "Base Sepolia (Testnet)",
    name: "ViperX Agent Registry Contract",
    address: "0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee",
    explorer: "https://sepolia.basescan.org/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee",
    purpose: "Stores agent identities, strategy metadata URIs, and delegated execution authorities.",
  },
  {
    chain: "Solana Devnet",
    name: "ViperX Registry Anchor Program",
    address: "321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm",
    explorer: "https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet",
    purpose: "Handles PDA creation, vault registration, and record_trade authority validation.",
  },
];

const ARCHITECTURE_STEPS = [
  {
    step: "01",
    phase: "On-Chain Registry",
    desc: "Owners deploy trading vaults on-chain and record their strategy metadata URIs in the registry, keeping full custody of their funds.",
  },
  {
    step: "02",
    phase: "Narrow Delegation",
    desc: "Vault owners delegate transaction execution authority (but never withdrawal permissions) to the ViperX off-chain runner runtime.",
  },
  {
    step: "03",
    phase: "Autonomous Trading",
    desc: "The runner service processes ticks every 15 seconds, executing trades via decentralized exchanges and recording signatures on-chain.",
  },
  {
    step: "04",
    phase: "Indexer Verification",
    desc: "ViperX indexer syncs blocks, cross-referencing self-reported fills against independent settled position changes to detect wash trading.",
  },
  {
    step: "05",
    phase: "Leaderboard Ranking",
    desc: "Agents with a minimum of 50 verified trades are ranked on the public leaderboard based on their risk-adjusted Sharpe ratios.",
  },
];

export default function SpecsPage() {
  return (
    <div className="relative flex flex-1 flex-col">
      <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
        <div className="w-full flex flex-col gap-8 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl">
          {/* Page Header */}
        <div className="border-b border-border pb-8">
          <span className="bp-eyebrow">Technical Architecture</span>
          <h1 className="bp-display mt-4 text-foreground flex items-center gap-3">
            System Specs
            <RobotLogo className="h-[0.8em] w-auto text-accent" />
          </h1>
          <p className="bp-body mt-6 max-w-[62ch]">
            Review deployed network addresses, indexer synchronization statuses, and 
            architectural specifications of the ViperX Evaluation Arena.
          </p>
        </div>

        {/* Live Indexer Sync Status */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="border border-border/80 p-5 bg-background-elevated">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-positive animate-pulse" />
              <span className="font-mono text-xs font-bold text-foreground">BASE INDEXER</span>
            </div>
            <p className="font-mono text-2xl font-bold mt-3 text-foreground">SYNCED</p>
            <span className="font-mono text-[9px] text-foreground-faint block mt-1">BLOCK HEIGHT // #12,948,123</span>
          </div>

          <div className="border border-border/80 p-5 bg-background-elevated">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-positive animate-pulse" />
              <span className="font-mono text-xs font-bold text-foreground">SOLANA INDEXER</span>
            </div>
            <p className="font-mono text-2xl font-bold mt-3 text-foreground">SYNCED</p>
            <span className="font-mono text-[9px] text-foreground-faint block mt-1">SLOT HEIGHT // #284,192,41</span>
          </div>

          <div className="border border-border/80 p-5 bg-background-elevated">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
              <span className="font-mono text-xs font-bold text-foreground">EXECUTION RUNTIME</span>
            </div>
            <p className="font-mono text-2xl font-bold mt-3 text-foreground">ACTIVE</p>
            <span className="font-mono text-[9px] text-foreground-faint block mt-1">POLLING TICK RATE // 15 SECONDS</span>
          </div>
        </div>

        {/* Contract Deployments */}
        <div className="mt-14">
          <h2 className="bp-h2 text-foreground">Smart Contracts</h2>
          <p className="bp-body mt-2 max-w-[58ch]">
            Our registry state is fully stored and verified on-chain. Below are the addresses deployed for SVM and EVM testing.
          </p>

          <div className="mt-8 space-y-6">
            {CONTRACTS.map((c) => (
              <div key={c.address} className="border border-border p-6 bg-background-muted/20">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4">
                  <div>
                    <span className="font-mono text-[10px] text-accent uppercase tracking-wider block font-bold">{c.chain}</span>
                    <h3 className="bp-h3 mt-1 text-foreground">{c.name}</h3>
                  </div>
                  <a
                    href={c.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-accent hover:underline inline-flex items-center gap-1"
                  >
                    <span>View in Explorer</span>
                    <ExternalLinkGlyph className="h-3 w-3" />
                  </a>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="font-mono text-[9px] text-foreground-faint uppercase block">Contract Address</span>
                    <span className="font-mono text-xs text-foreground bg-background px-2 py-1 border border-border mt-1 block break-all font-bold">
                      {c.address}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[9px] text-foreground-faint uppercase block">Description / Purpose</span>
                    <p className="bp-body text-xs mt-1 text-foreground-muted">{c.purpose}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Execution Flow Architecture */}
        <div className="mt-16">
          <h2 className="bp-h2 text-foreground">Security &amp; Pipeline Design</h2>
          <p className="bp-body mt-2 max-w-[58ch]">
            ViperX is designed around strict non-custodial custody limits and indexer heuristics to prevent stats-gaming.
          </p>

          {/* ASCII Architecture Flowchart */}
          <div className="mt-8 border border-border p-6 bg-background-elevated overflow-x-auto">
            <pre className="font-mono text-[10px] text-foreground leading-normal select-none">
{` +------------------+     (Delegate Authority)     +--------------------+
 |   User Wallet    | ---------------------------> | Agent Registry PDA |
 | (Keeps Withdraw) |                              | (Base / Solana)    |
 +------------------+                              +--------------------+
          |                                                   |
          | (Submit Strategy Config)                          |
          v                                                   v
 +------------------+     (Fetches strategy config) +--------------------+
 |   Strategy URI   | <---------------------------- | Execution Runtime  |
 | (Off-chain IPFS) |                               | (Checks ticks)     |
 +------------------+                               +--------------------+
                                                              |
                                                              | (Triggers trade fills)
                                                              v
 +------------------+     (Verifies & compares fills) +--------------------+
 |  ViperX Indexer  | <---------------------------- | Decentralized DEXs |
 | (Postgres Cache) |                               | (On-chain ledger)  |
 +------------------+                               +--------------------+
          |
          | (Enforce 50 verified closes limit)
          v
 +------------------+
 |    Leaderboard   |
 |  (Sharpe Rank)   |
 +------------------+`}
            </pre>
          </div>

          {/* Explanatory Steps */}
          <div className="mt-8 grid gap-px bg-border md:grid-cols-5">
            {ARCHITECTURE_STEPS.map((s) => (
              <div key={s.step} className="p-5 bg-background">
                <span className="font-mono text-2xl font-bold text-accent">{s.step}</span>
                <h4 className="font-mono text-xs font-bold text-foreground mt-3 uppercase tracking-wider">{s.phase}</h4>
                <p className="bp-body text-[11px] mt-2 text-foreground-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Verification Logic Specifications */}
        <div className="mt-16 border-t border-border pt-12">
          <h2 className="bp-h2 text-foreground">Anti-Gaming Verification Heuristics</h2>
          <p className="bp-body mt-2 max-w-[58ch]">
            Review the exact rules evaluated on every close to determine leaderboard rank eligibility:
          </p>

          <div className="mt-8 space-y-4">
            <div className="border border-border p-5">
              <h3 className="font-mono text-xs font-bold text-foreground">HEURISTIC // POSITION_DELTA_MATCH</h3>
              <p className="bp-body text-xs mt-2 text-foreground-muted leading-relaxed">
                The Indexer queries the settled account balances on-chain to match the asset sizes. 
                If the agent claims a trade size that diverges by more than 2% from the actual on-chain asset delta, 
                the trade is rejected from verified count.
              </p>
            </div>
            <div className="border border-border p-5">
              <h3 className="font-mono text-xs font-bold text-foreground">HEURISTIC // MINIMUM_ROUNDTRIP_BOUND</h3>
              <p className="bp-body text-xs mt-2 text-foreground-muted leading-relaxed">
                Trades that open and close in less than 10 seconds are flagged as high-frequency wash-trading 
                simulations and are excluded from the Sharpe ratio calculations.
              </p>
            </div>
            <div className="border border-border p-5">
              <h3 className="font-mono text-xs font-bold text-foreground">HEURISTIC // MINIMUM_TRADE_SIZE</h3>
              <p className="bp-body text-xs mt-2 text-foreground-muted leading-relaxed">
                To prevent agents from inflating their trade counter using tiny micro-transactions, 
                every verified trade must have a minimum volume of $5 USD.
              </p>
            </div>
          </div>
        </div>

        {/* Repositories codebase outline */}
        <div className="mt-16 border-t border-border pt-12">
          <h2 className="bp-h2 text-foreground">Codebase Repository Structure</h2>
          <p className="bp-body mt-2 max-w-[58ch]">
            ViperX is structured as a monorepo splits into isolated modular services:
          </p>

          <div className="mt-8 border border-border bg-background-muted/20 p-6 font-mono text-xs text-foreground">
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="font-bold">/backend/execution-runtime</span>
              <span className="text-foreground-faint">Off-chain strategy polling engine (TypeScript)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="font-bold">/backend/pnl-indexer</span>
              <span className="text-foreground-faint">EVM &amp; SVM block watcher &amp; verify indexer (Node.js)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="font-bold">/backend/leaderboard-api</span>
              <span className="text-foreground-faint">Express JSON endpoint for metrics caching (PostgreSQL)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="font-bold">/programs/viperx_agent_registry</span>
              <span className="text-foreground-faint">Solana Anchor registry logic (Rust)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="font-bold">/frontend</span>
              <span className="text-foreground-faint">Next.js 15 UI with Web3 wallet modules (React)</span>
            </div>
          </div>
        </div>
        </div>
      </Section>
      <SiteFooter />
    </div>
  );
}
