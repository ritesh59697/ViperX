import { NextResponse } from "next/server";
import { getArenaSeasonsFromDb } from "@/lib/server/leaderboardService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const seasons = await getArenaSeasonsFromDb();
    return NextResponse.json({ seasons });
  } catch (error) {
    console.error("[api/arena/seasons] Error:", error);
    return NextResponse.json({ seasons: [] }, { status: 200 });
  }
}
