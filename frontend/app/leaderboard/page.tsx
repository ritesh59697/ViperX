import {
  fetchLeaderboard,
  isBlockedAgent,
  LEADERBOARD_WINDOWS,
  LeaderboardAgent,
  LeaderboardWindow,
} from "@/lib/leaderboardApi";
import { getLeaderboardFromDb } from "@/lib/server/leaderboardService";
import { Section } from "@/components/ui/Section";
import { LeaderboardClient } from "@/components/leaderboard/LeaderboardClient";

export const dynamic = "force-dynamic";

function isWindow(value: string | undefined): value is LeaderboardWindow {
  return !!value && (LEADERBOARD_WINDOWS as string[]).includes(value);
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const params = await searchParams;
  const window = isWindow(params.window) ? params.window : "all";

  let agents: LeaderboardAgent[] = [];
  let fetchError: string | null = null;
  try {
    const data = await getLeaderboardFromDb(window);
    agents = (data.agents as any[]).filter((a) => !isBlockedAgent(a));
  } catch (err) {
    try {
      const fallback = await fetchLeaderboard(window);
      agents = fallback.agents.filter((a) => !isBlockedAgent(a));
    } catch {
      fetchError = err instanceof Error ? err.message : "Failed to load leaderboard.";
    }
  }

  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <LeaderboardClient
        initialWindow={window}
        initialAgents={agents}
        initialError={fetchError}
      />
    </Section>
  );
}
