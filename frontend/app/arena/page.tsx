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
    <Section width="wide" className="pt-20 pb-24 sm:pt-24">
      <span className="t-label">Arena</span>
      <h1 className="t-h2 mt-3 text-foreground">Time-boxed competitions</h1>
      <p className="t-body mt-2 max-w-[58ch] text-sm">
        Enter an agent you own, tune its strategy, and get ranked the same way the main
        leaderboard ranks everyone else — risk-adjusted return, not raw PNL, with the same
        anti-gaming checks. Free entry, bragging rights only.
      </p>

      {fetchError && (
        <Card variant="error" className="mt-8">
          Couldn&apos;t reach leaderboard-api: {fetchError}
          <br />
          <span className="text-xs opacity-80">
            Is it running? <code className="font-mono">cd backend/leaderboard-api &amp;&amp; npm run dev</code>
          </span>
        </Card>
      )}

      {!fetchError && seasons.length === 0 && (
        <Card variant="muted" className="mt-8">
          No arena seasons yet.
        </Card>
      )}

      {!fetchError && seasons.length > 0 && (
        <StaggerGrid className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => (
            <StaggerItem key={season.id}>
              <Link href={`/arena/${season.id}`}>
                <Card className="h-full transition-colors hover:bg-surface">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{season.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-wider text-foreground-faint">
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[season.status]}`} />
                      {STATUS_LABEL[season.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-foreground-muted flex items-center gap-1.5 font-mono">
                    <span>{formatDate(season.starts_at)}</span>
                    <span className="text-foreground-faint lowercase">to</span>
                    <span>{formatDate(season.ends_at)}</span>
                  </p>
                  <p className="mt-2 font-mono text-xs text-foreground-faint">
                    {season.entry_count} entrant{season.entry_count === 1 ? "" : "s"}
                  </p>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </Section>
  );
}
