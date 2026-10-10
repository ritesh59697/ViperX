import { updateAgentMetrics } from "./metrics";
import { getAllAgentPdas, insertTrade, TradeRow } from "./store";

export async function processCompletedTrade(trade: TradeRow): Promise<number> {
  const tradeId = await insertTrade(trade);
  console.log(
    `[tradeIndexer] Indexed trade #${tradeId} for agent ${trade.agentPda.slice(0, 8)}... ` +
      `(PnL: $${trade.realizedPnl ?? 0})`
  );

  const snapshot = await updateAgentMetrics(trade.agentPda);
  console.log(
    `[tradeIndexer] Metrics updated for ${trade.agentPda.slice(0, 8)}... ` +
      `ROI: ${snapshot.roiPct}%, Sharpe: ${snapshot.sharpeLike ?? "N/A"}, Max DD: ${snapshot.maxDrawdownPct}%`
  );

  return tradeId;
}

export async function syncAllMetrics(): Promise<void> {
  const pdas = await getAllAgentPdas();
  for (const pda of pdas) {
    await updateAgentMetrics(pda);
  }
  console.log(`[tradeIndexer] Refreshed metrics snapshots for ${pdas.length} agent(s).`);
}
