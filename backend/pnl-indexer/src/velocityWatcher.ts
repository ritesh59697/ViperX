import { BN, BulkAccountLoader, VelocityClient, initialize, EventSubscriber } from "@velocity-exchange/sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { connection } from "./connection";
import {
  getAgentsWithVault,
  getUnverifiedClosedTrades,
  setTradeVerification,
  updateAgentVaultBalance,
} from "./store";
import { updateAgentMetrics } from "./metrics";

const SOL_PERP_MARKET_INDEX = 0;
const QUOTE_PRECISION = 1e6;
const DIVERGENCE_THRESHOLD_USD = 0.5;

export interface VelocityWatcherHandle {
  stop: () => void;
}

/**
 * Real-time event-log watcher for Velocity.
 * Subscribes to SettlePnlRecord events to detect closed/reversed positions
 * and reconciles them against self-reported trades.
 * Periodically polls and updates all agents' vault balances.
 */
export async function startVelocityWatcher(): Promise<VelocityWatcherHandle> {
  const agents = await getAgentsWithVault();
  if (agents.length === 0) {
    console.log("[velocityWatcher] no agents in Postgres yet — nothing to watch (restart after agents register).");
    return { stop: () => {} };
  }

  initialize({ env: "devnet" });

  const authoritySubAccountMap = new Map<string, number[]>();
  for (const agent of agents) {
    authoritySubAccountMap.set(agent.vaultPubkey, [0]);
  }

  const accountLoader = new BulkAccountLoader(connection, "confirmed", 5000);
  const wallet = new Wallet(Keypair.generate());
  const velocityClient = new VelocityClient({
    connection,
    wallet,
    env: "devnet",
    perpMarketIndexes: [SOL_PERP_MARKET_INDEX],
    spotMarketIndexes: [0, 1],
    accountSubscription: { type: "polling", accountLoader },
    authoritySubAccountMap,
  });

  // Handle errors from BulkAccountLoader and VelocityClient to prevent Node process termination on RPC network hiccups
  if ((accountLoader as any).eventEmitter) {
    (accountLoader as any).eventEmitter.on("error", (err: any) => {
      console.warn("[velocityWatcher] accountLoader error (handled):", err?.message || err);
    });
  }
  if ((velocityClient as any).eventEmitter) {
    (velocityClient as any).eventEmitter.on("error", (err: any) => {
      console.warn("[velocityWatcher] velocityClient error (handled):", err?.message || err);
    });
  }

  await velocityClient.subscribe();
  console.log(`[velocityWatcher] subscribed to ${agents.length} agent(s) on Velocity devnet`);

  const userPdaToAgentPda = new Map<string, string>();
  const lastBaseAssetAmount = new Map<string, BN>();

  for (const agent of agents) {
    const userPda = await velocityClient.getUserAccountPublicKey(0, new PublicKey(agent.vaultPubkey));
    userPdaToAgentPda.set(userPda.toBase58(), agent.agentPda);

    const userAccount = velocityClient.getUserAccount(0, new PublicKey(agent.vaultPubkey));
    if (userAccount) {
      const position = userAccount.perpPositions.find((p) => p.marketIndex === SOL_PERP_MARKET_INDEX);
      if (position) {
        lastBaseAssetAmount.set(agent.agentPda, position.baseAssetAmount);
      }
    }
  }

  const eventSubscriber = new EventSubscriber(connection, velocityClient.program as any, {
    eventTypes: ["SettlePnlRecord"],
    commitment: "confirmed",
  });

  if ((eventSubscriber as any).eventEmitter) {
    (eventSubscriber as any).eventEmitter.on("error", (err: any) => {
      console.warn("[velocityWatcher] eventSubscriber error (handled):", err?.message || err);
    });
  }

  await eventSubscriber.subscribe();
  console.log("[velocityWatcher] subscribed to SettlePnlRecord events");

  const reconcileClose = async (agentPda: string, realizedPnlUsd: number): Promise<void> => {
    const trades = (await getUnverifiedClosedTrades(agentPda)).filter((t) => t.id !== undefined);
    if (trades.length === 0) {
      console.warn(
        `[velocityWatcher][${agentPda.slice(0, 8)}...] observed an on-chain close but no matching ` +
          `unverified trades row exists yet (self-report may not have landed, or already verified).`
      );
      return;
    }

    const selfReportedTotal = trades.reduce((sum, t) => sum + Number(t.realizedPnl ?? 0), 0);
    const divergence = Math.abs(selfReportedTotal - realizedPnlUsd);
    const flagged = divergence > DIVERGENCE_THRESHOLD_USD;

    for (const trade of trades) {
      await setTradeVerification(trade.id!, realizedPnlUsd, flagged);
    }

    // Immediately re-compute agent snapshot metrics from on-chain verified PnL
    try {
      await updateAgentMetrics(agentPda);
    } catch (metricErr: any) {
      console.warn(`[velocityWatcher] failed to update metrics for ${agentPda.slice(0, 8)}:`, metricErr?.message);
    }

    const label =
      trades.length === 1
        ? `trade #${trades[0].id}`
        : `${trades.length} backlogged trades (#${trades[0].id}..#${trades[trades.length - 1].id}, aggregate)`;
    console.log(
      `[velocityWatcher][${agentPda.slice(0, 8)}...] verified ${label}: ` +
        `self-reported $${selfReportedTotal.toFixed(2)} vs on-chain $${realizedPnlUsd.toFixed(2)}` +
        (flagged ? " — DIVERGENCE FLAGGED" : "")
    );
  };

  eventSubscriber.eventEmitter.on("newEvent", async (wrappedEvent) => {
    try {
      if (wrappedEvent.eventType === "SettlePnlRecord") {
        const record = wrappedEvent as any;
        const userPdaStr = record.user.toBase58();
        const agentPda = userPdaToAgentPda.get(userPdaStr);
        if (!agentPda) return;

        if (record.marketIndex !== SOL_PERP_MARKET_INDEX) return;

        const prevBase = lastBaseAssetAmount.get(agentPda) || new BN(0);
        const newBase = record.baseAssetAmount;

        const wasOpen = !prevBase.isZero();
        const isOpen = !newBase.isZero();

        let isCloseOrReversal = false;
        if (wasOpen && !isOpen) {
          isCloseOrReversal = true;
        } else if (wasOpen && isOpen && prevBase.isNeg() !== newBase.isNeg()) {
          isCloseOrReversal = true;
        }

        if (isCloseOrReversal) {
          const realizedPnlUsd = record.pnl.toNumber() / QUOTE_PRECISION;
          console.log(
            `[velocityWatcher][${agentPda.slice(0, 8)}...] SettlePnlRecord close detected: ` +
              `pnl = $${realizedPnlUsd.toFixed(2)}, size = ${newBase.toString()}`
          );
          await reconcileClose(agentPda, realizedPnlUsd);
        }

        lastBaseAssetAmount.set(agentPda, newBase);
      }
    } catch (err) {
      console.error("[velocityWatcher] error processing SettlePnlRecord event:", err);
    }
  });

  const updateBalances = async () => {
    for (const { agentPda, vaultPubkey } of agents) {
      try {
        const user = velocityClient.getUser(0, new PublicKey(vaultPubkey));
        if (user) {
          const totalCollateral = user.getTotalCollateral().toNumber() / QUOTE_PRECISION;
          await updateAgentVaultBalance(agentPda, totalCollateral);
        }
      } catch (err) {
        // user may not be initialized/subscribed yet
      }
    }
  };

  // Fetch initial balances
  await updateBalances().catch((err) =>
    console.error("[velocityWatcher] failed to update initial balances:", err)
  );

  // Poll collateral balances every 30 seconds
  const balanceInterval = setInterval(() => {
    updateBalances().catch((err) =>
      console.error("[velocityWatcher] failed to update balances:", err)
    );
  }, 30000);

  return {
    stop: () => {
      clearInterval(balanceInterval);
      eventSubscriber.unsubscribe().catch((err) =>
        console.error("[velocityWatcher] error unsubscribing eventSubscriber:", err)
      );
      velocityClient.unsubscribe().catch((err) =>
        console.error("[velocityWatcher] error unsubscribing velocityClient:", err)
      );
    },
  };
}
