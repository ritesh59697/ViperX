import { NextResponse } from "next/server";
import { getLeaderboardFromDb } from "@/lib/server/leaderboardService";
import {
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
    const data = await getLeaderboardFromDb(window);
    const filtered = (data.agents || []).filter((a: any) => !isBlockedAgent(a));
    return NextResponse.json({
      window: data.window,
      ranked_count: filtered.filter((a: any) => a.onchain_verified).length,
      agents: filtered,
    });
  } catch (error) {
    console.error("API /api/leaderboard direct DB error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
