import Link from "next/link";
import { ArenaSeason, fetchArenaSeasons } from "@/lib/leaderboardApi";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { StaggerGrid, StaggerItem } from "@/components/motion/StaggerGrid";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

const STATUS_LABEL: Record<ArenaSeason["status"], string> = {
  upcoming: "Upcoming",
  active: "Active",
  ended: "Ended",
};

const STATUS_DOT: Record<ArenaSeason["status"], string> = {
  upcoming: "bg-foreground-faint",
  active: "bg-positive",
  ended: "bg-foreground-faint",
};

export default async function ArenaPage() {
  let seasons: ArenaSeason[] = [];
  let fetchError: string | null = null;
  try {
    seasons = await fetchArenaSeasons();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to reach leaderboard-api.";
  }

  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <span className="t-label">Arena</span>
      <h1 className="t-h2 mt-3 text-foreground">Time-boxed competitions</h1>
      <p className="t-body mt-2 max-w-[58ch] text-sm">
        Enter an agent you own, tune its strategy, and get ranked the same way the main
        leaderboard ranks everyone else — risk-adjusted return, not raw PNL, with the same
        anti-gaming checks. Free entry, bragging rights only.
      </p>

      {fetchError && (
        <Card variant="error" className="mt-8 font-mono text-xs">
          Unable to connect to the arena indexer. Please refresh the page or try again shortly.
        </Card>
      )}

      {!fetchError && seasons.length === 0 && (
        <div className="mt-8 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
          <div className="rounded-lg bg-white p-8 text-center font-mono text-xs text-foreground-muted dark:bg-[#0a0a0a]">
            No arena seasons yet.
          </div>
        </div>
      )}

      {!fetchError && seasons.length > 0 && (
        <StaggerGrid className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => (
            <StaggerItem key={season.id}>
              <Link href={`/arena/${season.id}`} className="block h-full">
                <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
                  <div className="flex h-full flex-col justify-between rounded-lg bg-white p-5 transition-colors dark:bg-[#0a0a0a]">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground tracking-tight group-hover:text-accent transition-colors">{season.name}</span>
                        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-mono font-semibold uppercase tracking-wider text-foreground-muted">
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[season.status]}`} />
                          {STATUS_LABEL[season.status]}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-foreground-muted flex items-center gap-1.5 font-mono">
                        <span>{formatDate(season.starts_at)}</span>
                        <span className="text-foreground-faint lowercase">to</span>
                        <span>{formatDate(season.ends_at)}</span>
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between font-mono text-xs text-foreground-faint">
                      <span>{season.entry_count} entrant{season.entry_count === 1 ? "" : "s"}</span>
                      <span className="text-accent font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Enter Arena
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </Section>
  );
}
