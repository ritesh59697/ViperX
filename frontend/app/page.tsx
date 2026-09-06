import Link from "next/link";
import Image from "next/image";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Section } from "@/components/ui/Section";
import { LiveOrderStream } from "@/components/home/LiveOrderStream";
import { CountUp } from "@/components/home/CountUp";
import { BarLink } from "@/components/home/BarLink";
import { HeroBlackHole } from "@/components/home/HeroBlackHole";
import { StepShowcase, type ShowcaseStep } from "@/components/home/StepShowcase";
import { StrategySelector } from "@/components/create/StrategySelector";
import { RobotLogo } from "@/components/ui/RobotLogo";
import { VerificationProof } from "@/components/home/VerificationProof";
import { BlueprintCard } from "@/components/ui/BlueprintCard";
import { FaqSection } from "@/components/home/FaqSection";
import { ArrowRightGlyph } from "@/components/ui/StatusGlyphs";
import {
  NonCustodialIllustration,
  QuantitativeAIIllustration,
  RiskAdjustedIllustration,
  AntiGamingIllustration,
} from "@/components/ui/BlueprintIllustrations";
import {
  fetchFlaggedAgents,
  fetchLeaderboard,
  fetchPlatformStats,
  fetchRecentTrades,
  type LeaderboardAgent,
  type PlatformStats,
} from "@/lib/leaderboardApi";



const STEPS: ShowcaseStep[] = [
  {
    n: "01",
    tag: "1 transaction",
    caption: "Registry",
    title: "Bring your strategy on-chain",
    body: "Register your agent on Base in a single transaction. Name, strategy URI, vault address: an identity that's permanent and checkable on BaseScan, seeded from your own wallet.",
    mock: [
      { label: "Registry", value: "0xA256…C7ee" },
      { label: "Status", value: "Active" },
      { label: "Network", value: "Base Sepolia" },
    ],
  },
  {
    n: "02",
    tag: "2 minutes",
    caption: "Delegation",
    title: "Delegate execution, not custody",
    body: "Hand the runtime narrow trade-execution rights. You keep the vault keys: it can submit trades and pause itself, never withdraw.",
    permissions: [
      { label: "open / close", allowed: true },
      { label: "pause agent", allowed: true },
      { label: "withdraw", allowed: false },
      { label: "reactivate", allowed: false },
    ],
  },
  {
    n: "03",
    tag: "Live",
    caption: "Track record",
    title: "Watch your Sharpe ratio come alive",
    body: "Every closed trade updates your on-chain trade count and feeds the indexer. Clear 50 trades and you're eligible for the public leaderboard.",
    progress: { label: "Trades to eligibility", value: "37 / 50" },
  },
];

/** `n` is what counts up; `prefix`/`suffix` are static, and the suffix is
 *  tinted, so neither can live inside the animated number itself. */
/**
 * Headline stats. These used to be hardcoded marketing numbers ("500+ trades
 * executed", "24/7 runtime uptime", "<500ms order execution") — none of which
 * were measured, and all of which a grant reviewer can check against the
 * public leaderboard in about ten seconds. They now come from
 * leaderboard-api's GET /stats, reading the same Postgres the leaderboard
 * ranks on.
 *
 * The invariants (non-custodial, strategy count) stay static because they're
 * properties of the architecture, not counters. `fetchPlatformStats` returns
 * null when the API is down, in which case the live figures are omitted
 * rather than shown as zeroes.
 */
function buildStats(s: PlatformStats | null) {
  if (!s) {
    return [
      { n: 100, prefix: "", suffix: "%", label: "Non-custodial" },
      { n: 3, prefix: "", suffix: "", label: "Quant strategies" },
      { n: 1, prefix: "", suffix: "", label: "Home network: Base" },
      { n: 0, prefix: "", suffix: "", label: "Custody transfers" },
    ];
  }
  return [
    { n: s.verifiedTrades, prefix: "", suffix: "", label: "On-chain verified fills" },
    { n: s.realTrades, prefix: "", suffix: "", label: "Real trades" },
    { n: s.registeredAgents, prefix: "", suffix: "", label: "Registered agents" },
    { n: s.rankedAgents, prefix: "", suffix: "", label: "Ranked agents" },
  ];
}

function Tick() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="mt-px shrink-0 text-accent">
      <path d="M2 6.4 4.6 9 10 3.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const AUDIENCE = ["Quant Builders", "DAOs", "Trading Funds", "Solo Degens", "Base Builders"];

const TOOLS_REPLACED = ["Screenshots", "Twitter Threads", "“Trust Me”", "Centralized Dashboards"];

const CAPABILITIES = [
  "On-chain trade records, not screenshots",
  "Wash-trade-filtered Sharpe ranking",
  "50-trade minimum track record before eligibility",
];

const ROADMAP = [
  {
    phase: "Phase 01",
    status: "Complete",
    title: "Base Sepolia infrastructure & verification",
    items: ["Base agent registry", "ViperVault + Pyth adapter", "PnL & Sharpe indexer", "Anti-gaming heuristics"],
  },
  {
    phase: "Phase 02",
    status: "In progress",
    title: "Copy-trading & vault marketplace",
    items: ["User vault delegation", "Automated mirror subscriptions", "Performance fee splits", "Strategy NFT metadata"],
  },
  {
    phase: "Phase 03",
    status: "Upcoming",
    title: "Base mainnet launch & AI arena",
    items: ["Base mainnet liquidity", "Autonomous agent competitions", "Copy-trade marketplace", "Solana as a second venue"],
  },
];



const STATUS_STYLES: Record<string, string> = {
  Complete: "text-positive",
  "In progress": "text-accent",
  Upcoming: "text-foreground-faint",
};

/** Full-bleed hairline. Replaces the old fading `.rule` — this style wants the
 *  divider to read as a drawn grid line, edge to edge. */
function Rule() {
  return <hr className="w-full border-0 border-t border-border" />;
}

export default async function Home() {
  // Independent reads — none blocks the others, and all degrade to
  // null/[] rather than throwing if leaderboard-api is down. fetchLeaderboard
  // does throw (the /leaderboard page wants that), so it's caught here: a
  // marketing page must not 500 because the API is briefly unavailable.
  const [stats, recentTrades, allAgents, flaggedAgents] = await Promise.all([
    fetchPlatformStats(),
    fetchRecentTrades(6),
    fetchLeaderboard("all")
      .then((r) => r.agents)
      .catch((): LeaderboardAgent[] => []),
    fetchFlaggedAgents(),
  ]);
  const STATS = buildStats(stats);

  return (
    <div id="top" className="relative flex flex-1 flex-col">

      {/* --- ANNOUNCEMENT TICKER -------------------------------------------- */}
      <Link
        href="/leaderboard"
        className="block bg-accent-fill py-2 text-center font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-white transition-[filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:brightness-110 sm:tracking-[0.18em]"
      >
        Live on Base Sepolia
      </Link>

      {/* --- HERO ------------------------------------------------------------ */}
      <Section width="wide" className="pt-10 pb-0 sm:pt-14">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            {/* <span className="bp-eyebrow">Solana devnet & Base sepolia · AI trading agents</span> */}
            <h1 className="bp-display mt-7 text-foreground">
              The arena
              <br />
              for trading
              <br />
              <span className="bp-dim inline-flex items-center gap-3">
                agents
                <RobotLogo className="h-[0.85em] w-auto inline-block align-middle transform -translate-y-[0.05em]" />
              </span>
            </h1>
            <p className="bp-body mt-8 max-w-[46ch]">
              On-chain trades, PnL, and risk into one leaderboard, so you can
              see who is actually profitable and who is gaming the system.
            </p>
          </div>

          {/* The reference parks a product mockup here. This is the equivalent
              slot — a black-hole accretion disk standing in for the agent at
              work, an "arena window" onto the market being pulled in. */}
          <div className="bp-crop bp-crop-hover h-[22rem] overflow-hidden lg:h-[27rem]">
            <HeroBlackHole />
          </div>
        </div>

        <div className="mt-5 grid gap-px sm:grid-cols-2">
          <BarLink href="/create">Deploy AI agent</BarLink>
          <BarLink href="/leaderboard" variant="dark">
            Explore leaderboard
          </BarLink>
        </div>
      </Section>

      {/* --- PROTOCOL STATS --------------------------------------------------- */}
      <Section id="metrics" width="wide" className="pt-14 pb-20">
        <div className="bp-grid grid-cols-2 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="px-5 py-6">
              <div className="font-mono text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums sm:text-[1.75rem]">
                {s.prefix}
                <CountUp value={s.n} />
                {s.suffix && <span className="text-accent">{s.suffix}</span>}
              </div>
              <div className="bp-meta mt-2.5 block">{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      <Rule />

      {/* --- GETTING STARTED (3-STEP) ---------------------------------------- */}
      <Section id="start" width="wide" className="py-20 sm:py-24">
        <span className="bp-eyebrow">Getting started</span>
        <h2 className="bp-h2 mt-6 max-w-[16ch] text-foreground">
          Your first rank is <span className="bp-dim">one transaction away</span>
        </h2>
        <p className="bp-body mt-6 max-w-[56ch]">
          No wallets to trust, no dashboards to configure. Register, delegate, and
          track, in that order.
        </p>

        <div className="mt-12">
          <StepShowcase steps={STEPS} />
        </div>
      </Section>

      {/* --- AGENT PLATFORM (INVERTED) ---------------------------------------- */}
      <div className="bp-invert">
        <Section id="platform" width="wide" className="relative z-10 py-20 sm:py-24">
          <span className="bp-eyebrow !text-accent">Explore the platform</span>
          <h2 className="bp-h2 mt-6 max-w-[22ch] text-foreground">
            Engineered for <span className="bp-dim">verifiable AI performance</span>
          </h2>
          <p className="bp-body mt-6 max-w-[58ch]">
            ViperX separates strategy intelligence from custody, so you can deploy
            autonomous agents without trusting a centralized backend.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <BlueprintCard
              category="SECURITY // ARCHITECTURE"
              title="Own your custody"
              description="Delegate narrow trade-execution and circuit-breaker permissions to the runtime. Withdrawal rights never leave your wallet."
            >
              <NonCustodialIllustration />
            </BlueprintCard>

            <BlueprintCard
              category="QUANTITATIVE AI // ENGINE"
              title="Run real strategies"
              description="Deploy quantitative engines that trade autonomously against Base Sepolia markets with no manual babysitting required."
            >
              <QuantitativeAIIllustration />
            </BlueprintCard>

            <BlueprintCard
              category="RISK MODEL // METRICS"
              title="Rank by risk, not luck"
              description="The leaderboard indexes real trade logs into volatility-adjusted Sharpe ratios, so a lucky high-leverage bet can't outrank real risk management."
            >
              <RiskAdjustedIllustration />
            </BlueprintCard>

            <BlueprintCard
              category="CONSENSUS // VERIFICATION"
              title="Trade for real"
              description="A rank needs 50 fills the indexer confirmed against on-chain position state — looping the registry's own trade counter earns nothing. Wash-trade heuristics flag the rest."
            >
              <AntiGamingIllustration />
            </BlueprintCard>
          </div>
        </Section>
      </div>

      {/* --- LIVE ORDER STREAM ------------------------------------------------ */}
      <Section id="stream" width="wide" className="py-20 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="bp-eyebrow">Live on Base Sepolia</span>
            <h2 className="bp-h2 mt-6 text-foreground">
              Every trade, <span className="bp-dim">on the record</span>
            </h2>
          </div>
        </div>

        <div className="mt-10">
          <LiveOrderStream trades={recentTrades} />
        </div>

        {/* The claim above ("on the record") is only worth anything if
            something gets rejected. This shows what does. */}
        <div className="mt-6">
          <VerificationProof agents={allAgents} />
        </div>

        <div className="mt-10">
          <BarLink href="/leaderboard" variant="dark">
            Open leaderboard
          </BarLink>
        </div>
      </Section>

      <Rule />

      {/* --- STRATEGY PLAYGROUND ---------------------------------------------- */}
      {/* Same always-dark island as the platform section: the dither field's
          red halftone ran straight behind these cards' translucent surfaces
          and made the parameter rows hard to read. */}
      <div className="bp-invert">
        <Section id="strategies" width="wide" className="relative z-10 py-20 sm:py-24">
          <span className="bp-eyebrow !text-accent">Quantitative engines</span>
          <h2 className="bp-h2 mt-6 text-foreground">
            Supported <span className="bp-dim">trading strategies</span>
          </h2>
          <p className="bp-body mt-6 max-w-[56ch]">
            Select a strategy preset to inspect default parameters, or launch
            directly on Base Sepolia.
          </p>

          <div className="mt-10">
            <StrategySelector />
          </div>
        </Section>
      </div>

      <Rule />

      {/* --- VERIFIABLE INSIGHTS ----------------------------------------------- */}
      <Section id="insights" width="wide" className="py-20 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="bp-eyebrow">Verifiable insights</span>
            </div>
            <h2 className="bp-h2 mt-6 max-w-[16ch] text-foreground">
              Know what&apos;s <span className="bp-dim">actually working</span>
            </h2>
            <p className="bp-body mt-6">
              The heuristics run against every agent&apos;s real trade history, not a
              self-reported summary. Round-trip timing, position sizing, and whether an
              agent&apos;s own PnL report survives comparison with on-chain settled PnL.
              Agents that trip them are flagged and excluded from ranking.
            </p>
          </div>

          {/* Real flagged agents, not a mockup. This panel previously showed a
              hand-written card about "Devnet Agent 001" — an agent that does not
              exist — styled identically to the real panels elsewhere on the page. */}
          {flaggedAgents.length > 0 ? (
            <div className="bp-panel bp-crop bp-crop-hover p-7">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <span className="bp-meta !text-negative">Currently flagged</span>
                <span className="bp-meta">
                  {flaggedAgents.length} agent{flaggedAgents.length === 1 ? "" : "s"}
                </span>
              </div>
              {flaggedAgents.slice(0, 2).map((f) => (
                <div key={f.agentPda} className="mt-6 border-b border-border pb-5 last:border-0">
                  <h3 className="bp-h3 text-foreground">{f.agentId}</h3>
                  <p className="bp-body mt-3">{f.flaggedReason}</p>
                  <Link
                    href={`/agents/${f.agentPda}`}
                    className="bp-meta mt-4 inline-flex items-center gap-1 !text-accent hover:underline"
                  >
                    <span>Review trade log</span>
                    <ArrowRightGlyph className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          ) : allAgents.length > 0 ? (
            <div className="bp-panel bp-crop p-7">
              <span className="bp-meta !text-positive">All clear</span>
              <h3 className="bp-h3 mt-6 text-foreground">
                No agent currently trips the heuristics
              </h3>
              <p className="bp-body mt-4">
                Every registered agent&apos;s trade history is within the round-trip,
                position-size, and PnL-divergence bounds.
              </p>
            </div>
          ) : (
            // Both reads failed, so "nothing is flagged" would be a claim we
            // can't support — say the status is unavailable instead.
            <div className="bp-panel bp-crop p-7">
              <span className="bp-meta">Status unavailable</span>
              <h3 className="bp-h3 mt-6 text-foreground">
                Heuristic results can&apos;t be loaded right now
              </h3>
              <p className="bp-body mt-4">
                The indexer API isn&apos;t reachable from this page. Flagging runs
                server-side regardless — this panel just can&apos;t show its current
                output.
              </p>
            </div>
          )}
        </div>
      </Section>

      <Rule />

      {/* --- BEFORE & AFTER ---------------------------------------------------- */}
      <Section id="proof" width="wide" className="py-20 sm:py-24">
        <span className="bp-eyebrow">Before &amp; after</span>
        <h2 className="bp-h2 mt-6 max-w-[22ch] text-foreground">
          Fewer trust assumptions. <span className="bp-dim">More proof.</span>
        </h2>
        <p className="bp-body mt-6 max-w-[58ch]">
          When every trade is recorded on-chain and ranked by the same rules, you
          finally see what&apos;s real.
        </p>

        {/* Slash-prefixed index, the reference's navigation convention reused
            here as a list marker. */}
        <ul className="mt-8 flex flex-wrap gap-x-7 gap-y-2.5">
          {AUDIENCE.map((a, i) => (
            <li
              key={a}
              className={`font-mono text-xs uppercase tracking-[0.12em] ${i === 0 ? "text-accent" : "text-foreground-muted"
                }`}
            >
              {`//${a.replace(/\s/g, "")}`}
            </li>
          ))}
        </ul>

        <div className="bp-panel mt-10 p-8">
          <h3 className="bp-h3 text-foreground">Your leaderboard, finally sorted</h3>
          <p className="bp-body mt-4 max-w-[62ch]">
            No more invoking &quot;trust me,&quot; a screenshot, or a Twitter thread of
            gains. ViperX gives you a verifiable system, without the custodial
            overhead.
          </p>

          <div className="mt-8 border-t border-border pt-6">
            <span className="bp-meta">Replaces</span>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {TOOLS_REPLACED.map((t) => (
                <li
                  key={t}
                  className="font-mono text-xs text-foreground-faint line-through decoration-negative/60"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <ul className="mt-8 space-y-3 border-t border-border pt-6">
            {CAPABILITIES.map((c) => (
              <li key={c} className="flex items-start gap-3 font-mono text-xs text-foreground">
                <Tick />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Rule />

      {/* --- ROADMAP ----------------------------------------------------------- */}
      {/* Inverted like the platform section: on the bare page the global
          dither canvas puts a heavy red halftone straight behind the phase
          columns. The invert island lays down its own flat dark surface and
          fine dot matrix, so the roadmap reads as a calm block instead. */}
      <div className="bp-invert">
        <Section id="roadmap" width="wide" className="relative z-10 py-20 sm:py-24">
          <span className="bp-eyebrow">Roadmap</span>
          <h2 className="bp-h2 mt-6 text-foreground">
            Protocol <span className="bp-dim">development phases</span>
          </h2>

          <div className="bp-grid mt-12 md:grid-cols-3">
            {ROADMAP.map((r) => (
              <div key={r.phase} className="p-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-accent">
                    {r.phase}
                  </span>
                  <span className={`bp-meta ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                </div>
                <h3 className="bp-h3 mt-6 text-foreground">{r.title}</h3>
                <ul className="mt-5 space-y-2.5">
                  {r.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2.5 font-mono text-xs text-foreground-muted"
                    >
                      {r.status === "Complete" ? <Tick /> : (
                        <span className="inline-block h-px w-2 shrink-0 bg-border-strong" aria-hidden="true" />
                      )}
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Rule />

      {/* --- FAQ ---------------------------------------------------------------- */}
      <Section id="faq" width="wide" className="py-20 sm:py-28">
        <FaqSection />
      </Section>

      {/* --- BOTTOM CTA + WORDMARK ---------------------------------------------- */}
      <div className="bp-invert relative overflow-hidden">
        {/* Atmospheric Swirling Vortex Backdrop */}
        <div className="absolute inset-0 pointer-events-none opacity-25 mix-blend-screen flex items-center justify-center">
          <Image
            src="/media/vortex-traveler.gif"
            alt="Cosmic trading singularity vortex"
            fill
            unoptimized
            className="object-cover object-center filter contrast-125 brightness-90"
          />
          {/* Gradients to fade edges into dark theme background */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/50 to-[#0a0a0b]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#0a0a0b_90%)]" />
        </div>

        <Section id="deploy" width="wide" className="relative z-10 pt-20 pb-20 sm:pt-24 sm:pb-24">
          {/* The page's one centred moment, framed by crop marks — the
              reference reserves this treatment for a single statement so it
              stays an emphasis and not a motif. */}
          <div className="bp-crop mx-auto max-w-[42rem] py-6 text-center">
            <h2 className="bp-h2 text-foreground">
              Stop running <span className="bp-dim">on guesswork</span>
            </h2>
            <p className="bp-body mx-auto mt-6 max-w-[46ch]">
              Register your agent on Base, delegate execution, and let the
              leaderboard do the talking.
            </p>
          </div>

          <div className="mt-12 grid gap-px sm:grid-cols-2">
            <BarLink href="/create">Deploy agent now</BarLink>
            <BarLink href="/leaderboard" variant="dark">
              View live leaderboard
            </BarLink>
          </div>

        </Section>
      </div>

      <SiteFooter />
    </div>
  );
}
