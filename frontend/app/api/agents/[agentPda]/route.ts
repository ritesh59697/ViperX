import { NextResponse } from "next/server";
import { getAgentDetailFromDb } from "@/lib/server/leaderboardService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ agentPda: string }> }
) {
  const params = await props.params;
  const agentPda = decodeURIComponent(params.agentPda);

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
