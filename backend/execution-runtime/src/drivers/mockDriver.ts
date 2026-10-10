import { Pool } from "pg";
import { ExecutionDriver } from "../driver";
import { AgentAccount, RegistryClient } from "../registryClient";
import { MarketSnapshot } from "../strategy";

interface MockPosition {
  side: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  openedAt: number;
  entryReason?: string;
}

export class MockExecutionDriver implements ExecutionDriver {
  name = "Mock (Paper Trading)";
  private mockPrice = 150.0; // Base SOL price in USD
  private openPositions = new Map<string, MockPosition>();
  private pool?: Pool;

  async init(_agents: AgentAccount[]): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.pool = new Pool({ connectionString: dbUrl });
      console.log("[MockDriver] Connected to Postgres for paper trade logging");
    }
    console.log("[MockDriver] Initialized Paper Trading Driver");
  }

  async getMarketSnapshot(marketSymbol: string): Promise<MarketSnapshot> {
    // Small realistic price movement (+/- 0.5%)
    const deltaPercent = (Math.random() - 0.48) * 0.01;
    this.mockPrice = Math.max(10.0, Number((this.mockPrice * (1 + deltaPercent)).toFixed(2)));

    return {
      marketSymbol,
      price: this.mockPrice,
      timestamp: Date.now(),
    };
  }

  async switchActiveUser(_agent: AgentAccount): Promise<void> {
    // No-op for mock execution
  }

  async openPosition(
    agent: AgentAccount,
    side: "long" | "short",
    sizeUsd: number,
    snapshot: MarketSnapshot,
    reason?: string
  ): Promise<{ sig?: string }> {
    const key = agent.publicKey.toBase58();
    this.openPositions.set(key, {
      side,
      sizeUsd,
      entryPrice: snapshot.price,
      openedAt: Date.now(),
      entryReason: reason,
    });

    console.log(
      `[MockDriver][${agent.agentId}] SIMULATED OPEN ${side.toUpperCase()} $${sizeUsd} @ $${snapshot.price} (${reason || "No reason"})`
    );
    return { sig: "simulated_open_tx" };
  }

  async closePosition(
    agent: AgentAccount,
    snapshot: MarketSnapshot,
    registry: RegistryClient,
    reason?: string
  ): Promise<{ sig?: string }> {
    const key = agent.publicKey.toBase58();
    const pos = this.openPositions.get(key);
    let pnlUsd = 0;

    if (pos) {
      const pnlPct =
        pos.side === "long"
          ? (snapshot.price - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - snapshot.price) / pos.entryPrice;
      pnlUsd = Number((pos.sizeUsd * pnlPct).toFixed(2));
      console.log(
        `[MockDriver][${agent.agentId}] SIMULATED CLOSE @ $${snapshot.price} (PnL: $${pnlUsd}, ${(pnlPct * 100).toFixed(2)}%)`
      );

      const combinedReason = `Entry: ${pos.entryReason || "N/A"} | Exit: ${reason || "N/A"}`;

      // Record trade to Postgres if available
      if (this.pool) {
        try {
          await this.pool.query(
            `INSERT INTO trades (agent_pda, market_symbol, side, size_usd, entry_price, exit_price, opened_at, closed_at, realized_pnl, tx_signature, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              agent.publicKey.toBase58(),
              snapshot.marketSymbol,
              pos.side,
              pos.sizeUsd,
              pos.entryPrice,
              snapshot.price,
              new Date(pos.openedAt),
              new Date(),
              pnlUsd,
              "simulated_tx_" + Date.now(),
              combinedReason,
            ]
          );

          // Update PnL snapshot
          const tradesRes = await this.pool.query(
            `SELECT realized_pnl::float FROM trades WHERE agent_pda = $1 AND closed_at IS NOT NULL`,
            [agent.publicKey.toBase58()]
          );
          const closedTrades = tradesRes.rows;
          const totalPnl = closedTrades.reduce((sum, r) => sum + Number(r.realized_pnl), 0);
          const roiPct = Number(((totalPnl / 1000) * 100).toFixed(2));

          let sharpeLike: number | null = null;
          if (closedTrades.length >= 2) {
            const returns = closedTrades.map((t) => Number(t.realized_pnl) / 1000);
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance =
              returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length - 1);
            const stdDev = Math.sqrt(variance);
            sharpeLike = stdDev > 0 ? Number(((mean / stdDev) * Math.sqrt(returns.length)).toFixed(2)) : 0;
          }

          await this.pool.query(
            `INSERT INTO pnl_snapshots (agent_pda, snapshot_at, realized_pnl, unrealized_pnl, roi_pct, max_drawdown_pct, sharpe_like)
             VALUES ($1, now(), $2, 0, $3, 0, $4)`,
            [agent.publicKey.toBase58(), totalPnl, roiPct, sharpeLike]
          );
          console.log(`[MockDriver][${agent.agentId}] Postgres trade & snapshot updated (Sharpe: ${sharpeLike ?? "N/A"})`);
        } catch (dbErr) {
          console.error(`[MockDriver][${agent.agentId}] Failed to record trade to Postgres:`, dbErr);
        }
      }

      this.openPositions.delete(key);
    } else {
      console.log(`[MockDriver][${agent.agentId}] SIMULATED CLOSE @ $${snapshot.price}`);
    }

    // Call real Anchor record_trade instruction on devnet to update on-chain track record!
    try {
      const sig = await registry.recordTrade(agent.publicKey);
      console.log(`[MockDriver][${agent.agentId}] ON-CHAIN record_trade tx: ${sig}`);
      return { sig };
    } catch (err) {
      console.error(`[MockDriver][${agent.agentId}] ON-CHAIN record_trade failed:`, err);
      return { sig: "simulated_close_tx_record_failed" };
    }
  }

  async getVaultBalance(_agent: AgentAccount): Promise<number> {
    // In mock mode, we simulate a default healthy balance of $1000
    return 1000.0;
  }
}
