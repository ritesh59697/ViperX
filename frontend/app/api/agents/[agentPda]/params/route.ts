import { NextResponse } from "next/server";
import { pool } from "@/lib/server/db";
import { badRequest, isAgentPda, isNonEmpty, ownershipError, readJson, tuneAgentMessage, verifyAgentOwnership } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ agentPda: string }> };

/**
 * Bounds per owner-tunable field. `caution` is deliberately absent: only the runtime's
 * auto-tuning may set it, and unknown keys are dropped rather than applied.
 */
const TUNABLE_BOUNDS: Record<string, [number, number]> = {
  thresholdBps: [10, 500],
  windowSize: [5, 100],
  gridSpacingBps: [5, 200],
  rsiLowerThreshold: [5, 45],
  rsiUpperThreshold: [55, 95],
  sizeUsd: [5, 1000],
};

export async function GET(_request: Request, props: Props) {
  const agentPda = decodeURIComponent((await props.params).agentPda);
  if (!isAgentPda(agentPda)) return badRequest("invalid agent id");
  const { rows } = await pool.query("SELECT params FROM agent_strategy_params WHERE agent_pda = $1", [agentPda]);
  return NextResponse.json({ params: rows[0]?.params ?? { caution: 0 } });
}

export async function PUT(request: Request, props: Props) {
  const agentPda = decodeURIComponent((await props.params).agentPda);
  if (!isAgentPda(agentPda)) return badRequest("invalid agent id");
  const b = await readJson(request);
  if (!b || typeof b.params !== "object" || b.params === null) return badRequest("params object is required");
  if (!isNonEmpty(b.nonce)) return badRequest("nonce is required");

  const params: Record<string, number> = {};
  for (const [k, v] of Object.entries(b.params as Record<string, unknown>)) {
    const bounds = TUNABLE_BOUNDS[k];
    if (!bounds || v === undefined || v === null) continue;
    if (typeof v !== "number" || v < bounds[0] || v > bounds[1]) return badRequest(`${k} must be between ${bounds[0]} and ${bounds[1]}`);
    params[k] = v;
  }

  const owned = await verifyAgentOwnership(agentPda, tuneAgentMessage(agentPda, b.nonce), b.signature);
  if (owned !== "ok") return ownershipError(owned);

  const existing: Record<string, number> =
    (await pool.query("SELECT params FROM agent_strategy_params WHERE agent_pda = $1", [agentPda])).rows[0]?.params ?? { caution: 0 };
  const merged = { ...existing, ...params };
  await pool.query(
    `INSERT INTO agent_strategy_params (agent_pda, params, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (agent_pda) DO UPDATE SET params = EXCLUDED.params, updated_at = EXCLUDED.updated_at`,
    [agentPda, merged],
  );
  for (const [param, newVal] of Object.entries(params)) {
    const oldVal = existing[param] ?? 0;
    if (oldVal !== newVal) {
      await pool.query(
        `INSERT INTO agent_tuning_history (agent_pda, param, old_value, new_value, reason) VALUES ($1, $2, $3, $4, $5)`,
        [agentPda, param, oldVal, newVal, `Owner manual adjustment: set ${param} to ${newVal}`],
      );
    }
  }
  return NextResponse.json({ params: merged });
}
