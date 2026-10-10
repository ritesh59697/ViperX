import { Pool } from "pg";
import { ExecutionDriver } from "../driver";
import { AgentAccount, RegistryClient } from "../registryClient";
import { MarketSnapshot } from "../strategy";
import { recordClosedTrade } from "../pnlWrite";

interface PaperPosition {
  side: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  openedAt: number;
  entryReason?: string;
}

export class PaperExecutionDriver implements ExecutionDriver {
  name = "Paper Trading Mode (Simulated)";
  private pool?: Pool;
  private openPositions = new Map<string, PaperPosition>();

  async init(_agents: AgentAccount[]): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.pool = new Pool({ connectionString: dbUrl });
      console.log("[PaperDriver] Connected to Postgres for paper trade logging");
    }
    console.log("[PaperDriver] Initialized Paper Trading Driver");
  }

  async getMarketSnapshot(marketSymbol: string): Promise<MarketSnapshot> {
    // Map standard symbols (e.g., SOL-PERP) to Binance spot tickers (e.g., SOLUSDT)
    const binanceSymbol = marketSymbol.replace("-PERP", "USDT");
    let price = 150.0; // Default fallback for SOL-PERP
    if (marketSymbol.startsWith("BTC")) price = 60000.0;
    if (marketSymbol.startsWith("ETH")) price = 3000.0;

    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
      if (res.ok) {
        const data = await res.json() as { price: string };
        price = parseFloat(parseFloat(data.price).toFixed(4));
        console.log(`[PaperDriver] Fetched live Binance price for ${marketSymbol}: $${price}`);
      } else {
        console.warn(`[PaperDriver] Non-200 from Binance API, using fallback: $${price}`);
      }
    } catch (err) {
      console.warn(`[PaperDriver] Failed to fetch live price from Binance, using fallback $${price}:`, err);
    }

    return {
      marketSymbol,
      price,
      timestamp: Date.now(),
    };
  }

  async switchActiveUser(_agent: AgentAccount): Promise<void> {
    // No-op for paper execution
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
      `[PaperDriver][${agent.agentId}] PAPER OPEN ${side.toUpperCase()} $${sizeUsd} @ $${snapshot.price} (${reason || "No reason"})`
    );
    return { sig: `paper_open_tx_${Date.now()}` };
  }

  async closePosition(
    agent: AgentAccount,
    snapshot: MarketSnapshot,
    _registry: RegistryClient,
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
        `[PaperDriver][${agent.agentId}] PAPER CLOSE @ $${snapshot.price} (PnL: $${pnlUsd}, ${(pnlPct * 100).toFixed(2)}%)`
      );

      const combinedReason = `Entry: ${pos.entryReason || "N/A"} | Exit: ${reason || "N/A"}`;

      if (this.pool) {
        try {
          // 1. Log the trade row with is_paper = true
          await recordClosedTrade(this.pool, {
            agentPda: agent.publicKey.toBase58(),
            marketSymbol: snapshot.marketSymbol,
            side: pos.side,
            sizeUsd: pos.sizeUsd,
            entryPrice: pos.entryPrice,
            exitPrice: snapshot.price,
            openedAt: pos.openedAt,
            txSignature: "paper_tx_" + Date.now(),
            reason: combinedReason,
            isPaper: true,
          });

          // 2. Adjust simulated balance in Postgres
          await this.pool.query(
            `UPDATE agents SET simulated_balance = simulated_balance + $1, updated_at = now() WHERE agent_pda = $2`,
            [pnlUsd, agent.publicKey.toBase58()]
          );
          
          console.log(`[PaperDriver][${agent.agentId}] Simulated balance updated in Postgres by PnL: $${pnlUsd}`);
        } catch (dbErr) {
          console.error(`[PaperDriver][${agent.agentId}] Failed to record paper trade:`, dbErr);
        }
      }

      this.openPositions.delete(key);
      return { sig: `paper_tx_${Date.now()}` };
    } else {
      console.warn(`[PaperDriver][${agent.agentId}] Attempted to close non-existent paper position`);
      return {};
    }
  }

  async getVaultBalance(agent: AgentAccount): Promise<number> {
    if (!this.pool) return 1000.0;
    try {
      const res = await this.pool.query(
        `SELECT simulated_balance::float FROM agents WHERE agent_pda = $1`,
        [agent.publicKey.toBase58()]
      );
      if (res.rows.length > 0) {
        return res.rows[0].simulated_balance;
      }
    } catch (err) {
      console.error(`[PaperDriver][${agent.agentId}] Failed to fetch simulated balance:`, err);
    }
    return 1000.0;
  }
}
