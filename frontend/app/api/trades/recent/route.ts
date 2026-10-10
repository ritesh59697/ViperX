import { NextRequest, NextResponse } from "next/server";
import { getRecentTradesFromDb } from "@/lib/server/leaderboardService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit") || 8);
    const trades = await getRecentTradesFromDb(limit);
    return NextResponse.json({ trades });
  } catch (err) {
    console.error("[api/trades/recent] Error:", err);
    return NextResponse.json({ trades: [] }, { status: 200 });
  }
}
