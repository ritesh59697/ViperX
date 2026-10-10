import { NextRequest, NextResponse } from "next/server";
import { getArenaSeasonDetailFromDb } from "@/lib/server/leaderboardService";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const { seasonId } = await params;
    const id = Number(seasonId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Season id must be an integer" }, { status: 400 });
    }

    const detail = await getArenaSeasonDetailFromDb(id);
    if (!detail) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[api/arena/seasons/[seasonId]] Error:", error);
    return NextResponse.json({ error: "Failed to fetch arena season" }, { status: 500 });
  }
}
