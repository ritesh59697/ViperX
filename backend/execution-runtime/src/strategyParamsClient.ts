const LEADERBOARD_API_URL = process.env.LEADERBOARD_API_URL || "http://localhost:4000";
const FETCH_TIMEOUT_MS = 3_000;

/**
 * Every field a strategy might read from its config, all optional. `caution`
 * is set only by pnl-indexer's skillEngine.ts (auto-tuning); the rest are
 * set only by a user's own signed PUT /agents/:agentPda/params (arena mode's
 * "tune your agent" step) — see leaderboard-api's UserTunableParamsSchema,
 * which deliberately excludes `caution` so the two can't clobber each other.
 * Absent fields stay `undefined`, not 0, so each strategy's own `?? default`
 * fallback still applies correctly.
 */
export interface TunedStrategyParams {
  caution: number;
  thresholdBps?: number;
  windowSize?: number;
  gridSpacingBps?: number;
  rsiLowerThreshold?: number;
  rsiUpperThreshold?: number;
  sizeUsd?: number;
}

const DEFAULT_PARAMS: TunedStrategyParams = { caution: 0 };

/**
 * Reads an agent's tuned strategy params (auto-tuned `caution` plus any
 * user-set numeric knobs) from leaderboard-api. Never throws and never
 * blocks the runner: this is a nice-to-have enhancement, not a correctness
 * requirement — if leaderboard-api is down or slow, strategies just run
 * with their unlearned/untuned defaults, same as before this feature
 * existed.
 */
export async function fetchTunedParams(agentPda: string): Promise<TunedStrategyParams> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${LEADERBOARD_API_URL}/agents/${agentPda}/params`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn(`[strategyParamsClient] ${agentPda}: leaderboard-api returned ${res.status}, using defaults`);
        return DEFAULT_PARAMS;
      }
      const body = (await res.json()) as { params?: Partial<TunedStrategyParams> };
      const params = body?.params ?? {};
      return {
        caution: typeof params.caution === "number" ? params.caution : 0,
        thresholdBps: typeof params.thresholdBps === "number" ? params.thresholdBps : undefined,
        windowSize: typeof params.windowSize === "number" ? params.windowSize : undefined,
        gridSpacingBps: typeof params.gridSpacingBps === "number" ? params.gridSpacingBps : undefined,
        rsiLowerThreshold: typeof params.rsiLowerThreshold === "number" ? params.rsiLowerThreshold : undefined,
        rsiUpperThreshold: typeof params.rsiUpperThreshold === "number" ? params.rsiUpperThreshold : undefined,
        sizeUsd: typeof params.sizeUsd === "number" ? params.sizeUsd : undefined,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.warn(`[strategyParamsClient] ${agentPda}: failed to fetch tuned params, using defaults:`, err);
    return DEFAULT_PARAMS;
  }
}
