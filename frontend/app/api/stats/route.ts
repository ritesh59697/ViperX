import { NextResponse } from "next/server";
import { getPlatformStatsFromDb } from "@/lib/server/leaderboardService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getPlatformStatsFromDb();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[api/stats] Error:", err);
    return NextResponse.json({ registeredAgents: 0, realTrades: 0, verifiedTrades: 0, divergenceFlaggedTrades: 0, rankedAgents: 0 }, { status: 200 });
  }
}
