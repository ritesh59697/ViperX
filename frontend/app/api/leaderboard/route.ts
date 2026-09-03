import { NextResponse } from "next/server";
import {
  fetchLeaderboard,
  isBlockedAgent,
  LeaderboardWindow,
  LEADERBOARD_WINDOWS,
} from "@/lib/leaderboardApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawWindow = searchParams.get("window") || "all";
  const window: LeaderboardWindow = (LEADERBOARD_WINDOWS as string[]).includes(rawWindow)
    ? (rawWindow as LeaderboardWindow)
    : "all";

  try {
    const data = await fetchLeaderboard(window);
    const filtered = (data.agents || []).filter((a) => !isBlockedAgent(a));
    return NextResponse.json({
      window: data.window,
      ranked_count: filtered.filter((a) => a.onchain_verified).length,
      agents: filtered,
    });
  } catch (error) {
    console.error("API /api/leaderboard error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
