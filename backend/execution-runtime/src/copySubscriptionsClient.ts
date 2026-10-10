const LEADERBOARD_API_URL = process.env.LEADERBOARD_API_URL || "http://localhost:4000";
const FETCH_TIMEOUT_MS = 3_000;

export interface CopySubscription {
  followerAgentPda: string;
  sourceAgentPda: string;
  sizeUsd: number;
}

/**
 * Reads every active copy-trading subscription from leaderboard-api once at
 * runner startup — mirrors strategyParamsClient.ts's fetchTunedParams exactly:
 * never throws, fails open to no subscriptions rather than blocking startup.
 * Resolved once, not live-hot-reloaded — same "fixed at startup" limitation
 * fetchTunedParams and the managed-agent list already accept; new follows
 * need a runner restart to take effect.
 */
export async function fetchActiveCopySubscriptions(): Promise<CopySubscription[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${LEADERBOARD_API_URL}/copy-subscriptions?active=true`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn(`[copySubscriptionsClient] leaderboard-api returned ${res.status}, treating as no subscriptions`);
        return [];
      }
      const body = (await res.json()) as { subscriptions?: CopySubscription[] };
      return Array.isArray(body?.subscriptions) ? body.subscriptions : [];
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.warn("[copySubscriptionsClient] failed to fetch copy subscriptions, treating as none:", err);
    return [];
  }
}
