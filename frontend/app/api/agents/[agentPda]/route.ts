import { indexInBackgroundIfStale } from "@/lib/server/indexerTrigger";
import { NextResponse } from "next/server";
import { getAgentDetailFromDb } from "@/lib/server/leaderboardService";

export const dynamic = "force-dynamic";
// Next.js reads this as static segment config, so it has to be a literal.
export const maxDuration = 60;

export async function GET(
  _request: Request,
  props: { params: Promise<{ agentPda: string }> }
) {
  const params = await props.params;
  const agentPda = decodeURIComponent(params.agentPda);

  // Keep the X Layer index fresh between cron runs; runs after the response is sent.
  indexInBackgroundIfStale(maxDuration * 750);

  try {
    const data = await getAgentDetailFromDb(agentPda);
    if (!data) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error(`API /api/agents/${agentPda} error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch agent details" },
      { status: 500 }
    );
  }
}
