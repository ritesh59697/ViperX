import { BN, BASE_PRECISION, BulkAccountLoader, VelocityClient, PositionDirection, initialize } from "@velocity-exchange/sdk";
import { Pool } from "pg";
import { connection, wallet } from "../connection";
import { ExecutionDriver } from "../driver";
import { AgentAccount, RegistryClient } from "../registryClient";
import { MarketSnapshot } from "../strategy";
import { recordClosedTrade } from "../pnlWrite";

const SOL_PERP_MARKET_INDEX = 0;

interface OpenPositionRecord {
  side: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  openedAt: number;
  entryReason?: string;
}

export class VelocityExecutionDriver implements ExecutionDriver {
  name = "Velocity DEX (Devnet)";
  private velocityClient?: VelocityClient;
  private pool?: Pool;
  // Keyed by agent PDA — closePosition needs the entry side/price/size that
  // openPosition saw, to compute realized PNL and write a complete trades
  // row. Same in-memory tracking pattern mockDriver.ts already uses.
  private openPositions = new Map<string, OpenPositionRecord>();

  async init(agents: AgentAccount[]): Promise<void> {
    initialize({ env: "devnet" });

    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.pool = new Pool({ connectionString: dbUrl });
      console.log("[VelocityDriver] Connected to Postgres for real trade logging");
    }

    const authoritySubAccountMap = new Map<string, number[]>();
    for (const agent of agents) {
      authoritySubAccountMap.set(agent.vaultPubkey.toBase58(), [0]);
    }

    const accountLoader = new BulkAccountLoader(connection, "confirmed", 1000);
    this.velocityClient = new VelocityClient({
      connection,
      wallet,
      env: "devnet",
      perpMarketIndexes: [SOL_PERP_MARKET_INDEX],
      spotMarketIndexes: [0, 1],
      accountSubscription: { type: "polling", accountLoader },
      authoritySubAccountMap,
    });

    await this.velocityClient.subscribe();
    console.log("[VelocityDriver] Connected to Velocity DEX devnet");
  }

  /**
   * Tears down the VelocityClient subscription.
   *
   * `subscribe()` starts a BulkAccountLoader polling every account on a timer
   * that outlives any single call. runner.ts builds one driver for the process
   * lifetime so it never needed this, but scripts that construct a fresh driver
   * per cycle (to dodge the stale-position bug documented on
   * build-track-record.ts) leak a live poller each time. Four of them
   * concurrently was enough to drive the public devnet RPC into sustained 429s
   * and crash the process from an unhandled `error` event inside
   * bulkAccountLoader.load().
   */
  async unsubscribe(): Promise<void> {
    if (!this.velocityClient) return;
    try {
      await this.velocityClient.unsubscribe();
    } catch (err) {
      // Teardown failure must not mask the caller's real outcome.
      console.warn("[VelocityDriver] unsubscribe failed (continuing):", err);
    }
    this.velocityClient = undefined;
  }

  async getMarketSnapshot(marketSymbol: string): Promise<MarketSnapshot> {
    if (!this.velocityClient) throw new Error("VelocityExecutionDriver not initialized");
    const oracle = this.velocityClient.getOracleDataForPerpMarket(SOL_PERP_MARKET_INDEX);
    return {
      marketSymbol,
      price: oracle.price.toNumber() / 1e6, // PRICE_PRECISION = 1e6
      timestamp: Date.now(),
    };
  }

  async switchActiveUser(agent: AgentAccount): Promise<void> {
    if (!this.velocityClient) throw new Error("VelocityExecutionDriver not initialized");
    await this.velocityClient.switchActiveUser(0, agent.vaultPubkey);
  }

  async openPosition(
    agent: AgentAccount,
    side: "long" | "short",
    sizeUsd: number,
    snapshot: MarketSnapshot,
    reason?: string
  ): Promise<{ sig?: string }> {
    if (!this.velocityClient) throw new Error("VelocityExecutionDriver not initialized");
    const baseAssetAmount = new BN(
       Math.round((sizeUsd / snapshot.price) * BASE_PRECISION.toNumber())
    );
    const direction = side === "long" ? PositionDirection.LONG : PositionDirection.SHORT;

    const sig = await this.velocityClient.openPosition(
      direction,
      baseAssetAmount,
      SOL_PERP_MARKET_INDEX,
      undefined,
      0
    );
    this.openPositions.set(agent.publicKey.toBase58(), {
      side,
      sizeUsd,
      entryPrice: snapshot.price,
      openedAt: Date.now(),
      entryReason: reason,
    });
    console.log(`[VelocityDriver][${agent.agentId}] opened ${side} $${sizeUsd} @ ${snapshot.price} (${reason || "No reason"})`);
    return { sig };
  }

  async closePosition(
    agent: AgentAccount,
    snapshot: MarketSnapshot,
    registry: RegistryClient,
    reason?: string
  ): Promise<{ sig?: string }> {
    if (!this.velocityClient) throw new Error("VelocityExecutionDriver not initialized");
    // The polling accountLoader refreshes on a 1000ms interval; force a fresh
    // read first so closePosition doesn't compute a stale (possibly zero)
    // position size right after openPosition — see NEXT_STEPS.md.
    await this.velocityClient.forceGetUserAccount(0, agent.vaultPubkey);
    const closeSig = await this.velocityClient.closePosition(SOL_PERP_MARKET_INDEX, undefined, 0);
    console.log(`[VelocityDriver][${agent.agentId}] closed position @ ${snapshot.price} (tx: ${closeSig})`);

    // The position is genuinely closed on-chain at this point — everything
    // below is bookkeeping (on-chain trade_count, Postgres history), not
    // trading. Each is independent and must not block the other: found
    // live (2026-07-23) that a record_trade 429 threw and skipped the
    // Postgres write entirely, silently losing a real trade's history even
    // though the close itself succeeded. Neither failure should trip
    // runner.ts's circuit breaker either — that's for repeated *trading*
    // failures, not an RPC hiccup in bookkeeping after a healthy trade.
    const agentPda = agent.publicKey.toBase58();
    const openPosition = this.openPositions.get(agentPda);
    this.openPositions.delete(agentPda);

    let sig: string | undefined;
    try {
      sig = await registry.recordTrade(agent.publicKey);
      console.log(`[VelocityDriver][${agent.agentId}] record_trade: ${sig}`);
    } catch (err) {
      console.error(
        `[VelocityDriver][${agent.agentId}] closed on-chain but record_trade failed — trade_count not bumped:`,
        err
      );
    }

    if (this.pool && openPosition) {
      try {
        const combinedReason = `Entry: ${openPosition.entryReason || "N/A"} | Exit: ${reason || "N/A"}`;
        await recordClosedTrade(this.pool, {
          agentPda,
          marketSymbol: snapshot.marketSymbol,
          side: openPosition.side,
          sizeUsd: openPosition.sizeUsd,
          entryPrice: openPosition.entryPrice,
          exitPrice: snapshot.price,
          openedAt: openPosition.openedAt,
          txSignature: closeSig,
          reason: combinedReason,
        });
        console.log(`[VelocityDriver][${agent.agentId}] real trade + PNL snapshot written to Postgres`);
      } catch (err) {
        console.error(`[VelocityDriver][${agent.agentId}] failed to write trade/PNL to Postgres:`, err);
      }
    } else if (!openPosition) {
      console.error(
        `[VelocityDriver][${agent.agentId}] closed on-chain but no tracked entry price — trade not recorded to Postgres. ` +
          `This means the runner restarted between open and close (in-memory tracking doesn't survive that).`
      );
    }

    return { sig };
  }

  async getVaultBalance(agent: AgentAccount): Promise<number> {
    if (!this.velocityClient) return 0;
    try {
      // Force refresh user account from RPC
      const userAccount = await this.velocityClient.forceGetUserAccount(0, agent.vaultPubkey);
      if (!userAccount) return 0;

      // Spot market index 0 is dUSDT
      const spotPosition = userAccount.spotPositions.find((p) => p.marketIndex === 0);
      if (!spotPosition) return 0;

      // spotPosition.scaledBalance is BN. Convert to actual token balance (6 decimals for dUSDT/USDC)
      // Note: We use spotPosition.scaledBalance to determine balance in Velocity SDK.
      // Wait, is it scaledBalance or tokenAmount?
      // Velocity / Drift SDK usually represents spot balances as scaled balance, and you call
      // getSpotTokenAmount(spotPosition.scaledBalance, spotMarketAccount, spotPosition.balanceType)
      // to resolve the real amount.
      // For devnet dUSDT without scaling decimals factor complex queries, we can just do:
      // scaledBalance.toNumber() / 1e6 as a simple approximation if we want to be safe,
      // or we can read userAccount.spotPositions directly.
      const amount = spotPosition.scaledBalance.toNumber() / 1e6;
      return amount;
    } catch (err) {
      console.error(`[VelocityDriver][${agent.agentId}] Failed to fetch vault balance:`, err);
      return 0;
    }
  }
}
