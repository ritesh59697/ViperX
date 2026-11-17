import { NextResponse } from "next/server";
import { pool } from "@/lib/server/db";
import { arenaEntryMessage, badRequest, isAgentPda, ownershipError, readJson, verifyAgentOwnership } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

/** POST /api/arena/seasons/:seasonId/enter { agentPda, signature } */
export async function POST(request: Request, props: { params: Promise<{ seasonId: string }> }) {
  const seasonId = Number((await props.params).seasonId);
  if (!Number.isInteger(seasonId)) return badRequest("season id must be an integer");
  const b = await readJson(request);
  if (!b || !isAgentPda(b.agentPda)) return badRequest("agentPda is required");
  const agentPda = b.agentPda;

  const season = (await pool.query("SELECT ends_at FROM arena_seasons WHERE id = $1", [seasonId])).rows[0];
  if (!season) return NextResponse.json({ error: "season not found" }, { status: 404 });
  if (new Date() >= new Date(season.ends_at)) return badRequest("this season has already ended");
  const agent = (await pool.query("SELECT is_paper FROM agents WHERE agent_pda = $1", [agentPda])).rows[0];
  if (agent?.is_paper === true) return badRequest("paper agents are not eligible for the arena");

  const owned = await verifyAgentOwnership(agentPda, arenaEntryMessage(seasonId, agentPda), b.signature);
  if (owned !== "ok") return ownershipError(owned);

  await pool.query(
    `INSERT INTO arena_entries (arena_season_id, agent_pda) VALUES ($1, $2) ON CONFLICT (arena_season_id, agent_pda) DO NOTHING`,
    [seasonId, agentPda],
  );
  return NextResponse.json({ entered: true, seasonId, agentPda });
}
