import { NextResponse } from "next/server";
import { getFlaggedAgentsFromDb } from "@/lib/server/leaderboardService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const flagged = await getFlaggedAgentsFromDb();
    return NextResponse.json({ flagged });
  } catch (err) {
    console.error("[api/flagged-agents] Error:", err);
    return NextResponse.json({ flagged: [] }, { status: 200 });
  }
}
