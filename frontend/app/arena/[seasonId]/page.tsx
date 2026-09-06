import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArenaSeasonDetail,
  ArenaSeasonNotFoundError,
  fetchArenaSeason,
  LeaderboardAgent,
} from "@/lib/leaderboardApi";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowRightGlyph } from "@/components/ui/StatusGlyphs";
import { StaggerTableBody, StaggerRow } from "@/components/motion/StaggerTable";
import { EnterArenaModal } from "@/components/arena/EnterArenaModal";
import { ArenaMatchups } from "@/components/arena/ArenaMatchups";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function formatMetric(value: string | null, suffix = ""): string {
  if (value === null) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}${suffix}` : "—";
}

function truncate(address: string): string {
  return `${address.slice(0, 4)}..${address.slice(-4)}`;
}

const TH = "px-4 py-3 font-medium";
const TD = "px-4 py-3.5";

export default async function ArenaSeasonPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId: seasonIdRaw } = await params;
  const seasonId = Number(seasonIdRaw);

  let data: ArenaSeasonDetail | null = null;
  let fetchError: string | null = null;
  if (!Number.isInteger(seasonId)) {
    notFound();
  }
  try {
    data = await fetchArenaSeason(seasonId);
  } catch (err) {
    if (err instanceof ArenaSeasonNotFoundError) {
      notFound();
    }
    fetchError = err instanceof Error ? err.message : "Failed to reach leaderboard-api.";
  }

  const ranked: LeaderboardAgent[] = data ? data.entrants.filter((a) => a.onchain_verified) : [];
  const pending: LeaderboardAgent[] = data ? data.entrants.filter((a) => !a.onchain_verified) : [];

  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <div className="mb-8">
        <Link
          href="/arena"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] text-foreground-muted transition-colors hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to arena
        </Link>
      </div>

      {fetchError && (
        <Card variant="error" className="font-mono text-xs">
          Unable to connect to the arena indexer. Please refresh the page or try again shortly.
        </Card>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="t-h2 text-foreground">{data.season.name}</h1>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[0.6875rem] font-medium capitalize text-foreground-muted">
                  {data.season.status}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-foreground-faint flex items-center gap-1.5 font-mono">
                <span>{formatDate(data.season.starts_at)}</span>
                <span className="text-foreground-faint lowercase">to</span>
                <span>{formatDate(data.season.ends_at)}</span>
              </p>
            </div>

            {data.season.status !== "ended" && <EnterArenaModal seasonId={data.season.id} />}
          </div>

          <ArenaMatchups entrants={data.entrants} />

          {ranked.length === 0 && (
            <div className="mt-8 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
              <div className="rounded-lg bg-white p-8 text-center font-mono text-xs text-foreground-muted dark:bg-[#0a0a0a]">
                No entrant has qualified yet — same 50-verified-fill bar the main leaderboard uses.
              </div>
            </div>
          )}

          {ranked.length > 0 && (
            <div className="mt-8 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
              <div className="overflow-x-auto rounded-lg bg-white dark:bg-[#0a0a0a]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-black/5 bg-neutral-50 text-foreground-muted uppercase tracking-wider text-[10px] font-mono dark:border-white/5 dark:bg-[#111111]">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Agent</th>
                      <th className={TH}>Owner</th>
                      <th className={`${TH} text-right`}>Sharpe</th>
                      <th className={`${TH} text-right`}>ROI</th>
                      <th className={`${TH} text-right`}>Max DD</th>
                      <th className={`${TH} text-right`}>Profile</th>
                    </tr>
                  </thead>
                  <StaggerTableBody className="divide-y divide-black/5 font-mono text-xs dark:divide-white/5">
                    {ranked.map((agent) => (
                      <StaggerRow key={agent.agent_pda} className="transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                      <td className={`${TD} font-mono text-xs text-foreground-faint`}>{agent.rank}</td>
                      <td className={TD}>
                        <Link
                          href={`/agents/${agent.agent_pda}`}
                          prefetch={true}
                          className="group inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-accent font-sans text-sm"
                        >
                          <span className="group-hover:underline underline-offset-4 decoration-accent/60">{agent.name}</span>
                          <ArrowRightGlyph className="h-3 w-3 text-foreground-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                        </Link>
                        {agent.wash_trading_flagged && (
                          <span
                            className="mt-1 block text-[0.6875rem] font-medium text-negative"
                            title={agent.flagged_reason || "Flagged for wash trading patterns"}
                          >
                            Flagged
                          </span>
                        )}
                      </td>
                      <td className={`${TD} font-mono text-xs text-foreground-muted`}>{truncate(agent.owner)}</td>
                      <td className={`${TD} text-right font-mono text-xs font-medium text-foreground`}>
                        {formatMetric(agent.sharpe_like)}
                      </td>
                      <td className={`${TD} text-right font-mono text-xs font-medium text-foreground`}>
                        {formatMetric(agent.roi_pct, "%")}
                      </td>
                      <td className={`${TD} text-right font-mono text-xs text-foreground-muted`}>
                        {formatMetric(agent.max_drawdown_pct, "%")}
                      </td>
                      <td className={`${TD} text-right`}>
                        <Button
                          href={`/agents/${agent.agent_pda}`}
                          prefetch={true}
                          variant="secondary"
                          className="!py-1 !px-2.5 !text-[11px] !h-7 font-mono inline-flex items-center gap-1 hover:border-accent/40 hover:text-accent"
                        >
                          <span>View</span>
                          <ArrowRightGlyph className="h-2.5 w-2.5 opacity-70" />
                        </Button>
                      </td>
                    </StaggerRow>
                  ))}
                </StaggerTableBody>
                </table>
              </div>
            </div>
          )}

          {pending.length > 0 && (
            <div className="mt-12">
              <h2 className="t-label text-foreground-muted">Entered, not yet ranked</h2>
              <p className="t-body mt-2 max-w-[68ch] text-sm">
                Same bar as the main leaderboard — 50 independently verified fills before a score
                counts.
              </p>
              <div className="mt-5 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                <div className="overflow-x-auto rounded-lg bg-white dark:bg-[#0a0a0a]">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-black/5 bg-neutral-50 text-foreground-muted uppercase tracking-wider text-[10px] font-mono dark:border-white/5 dark:bg-[#111111]">
                      <tr>
                        <th className={TH}>Agent</th>
                        <th className={TH}>Owner</th>
                        <th className={`${TH} text-right`}>Verified fills</th>
                        <th className={`${TH} text-right`}>Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 font-mono text-xs dark:divide-white/5">
                      {pending.map((agent) => (
                        <tr key={agent.agent_pda} className="transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                          <td className={TD}>
                            <Link
                              href={`/agents/${agent.agent_pda}`}
                              prefetch={true}
                              className="group inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-accent font-sans text-sm"
                            >
                              <span className="group-hover:underline underline-offset-4 decoration-accent/60">{agent.name}</span>
                              <ArrowRightGlyph className="h-3 w-3 text-foreground-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                            </Link>
                          </td>
                          <td className={`${TD} font-mono text-xs text-foreground-muted`}>{truncate(agent.owner)}</td>
                          <td className={`${TD} text-right font-mono text-xs text-foreground`}>
                            {agent.verified_trade_count ?? 0} / 50
                          </td>
                          <td className={`${TD} text-right`}>
                            <Button
                              href={`/agents/${agent.agent_pda}`}
                              prefetch={true}
                              variant="secondary"
                              className="!py-1 !px-2.5 !text-[11px] !h-7 font-mono inline-flex items-center gap-1 hover:border-accent/40 hover:text-accent"
                            >
                              <span>View</span>
                              <ArrowRightGlyph className="h-2.5 w-2.5 opacity-70" />
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
        </>
      )}
    </Section>
  );
}
