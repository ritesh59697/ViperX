import { after } from "next/server";
import { pool } from "./db";
import { runXLayerIndexer } from "./xlayerIndexer";
import { XLAYER_NETWORK } from "@/lib/xlayer";

/**
 * Runs the X Layer indexer after the response is sent, at most once per
 * XLAYER_INDEXER_MIN_INTERVAL_S, so reads keep the leaderboard fresh between cron runs.
 * `budgetMs` is the time the caller's function may spend on it.
 */
export function indexInBackgroundIfStale(budgetMs: number): void {
  const minInterval = Number(process.env.XLAYER_INDEXER_MIN_INTERVAL_S);
  if (!Number.isInteger(minInterval) || minInterval <= 0) return; // only cron indexes when unset
  after(async () => {
    try {
      const { rows } = await pool.query(
        "SELECT extract(epoch FROM now() - updated_at) AS age FROM indexer_state WHERE key = $1",
        [`xlayer:${XLAYER_NETWORK.chainId}:cursor`],
      );
      if (rows[0] && Number(rows[0].age) < minInterval) return;
      await runXLayerIndexer(budgetMs);
    } catch (err) {
      console.error("[xlayer-indexer] background run failed:", err);
    }
  });
}
