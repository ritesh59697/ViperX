import { NextResponse } from "next/server";
import { pool } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/copy-subscriptions: every active copy subscription (public, like the leaderboard). */
export async function GET() {
  const { rows } = await pool.query(
    `SELECT follower_agent_pda AS "followerAgentPda", source_agent_pda AS "sourceAgentPda", size_usd AS "sizeUsd"
       FROM copy_subscriptions WHERE active = true`,
  );
  return NextResponse.json({ subscriptions: rows });
}
