import * as dotenv from "dotenv";
dotenv.config();

// Background account polling (e.g. VelocityClient's BulkAccountLoader
// refreshing subscribed accounts on its own timer) can throw from outside
// any single tick's try/catch in handleAgent — confirmed 2026-07-23, a
// public-devnet-RPC 429 there crashed the whole standing process rather
// than just failing that one poll. This is a standing service; log and
// keep running instead of dying to a transient RPC hiccup that the next
// poll would likely recover from on its own. See CLAUDE.md's RPC gotcha —
// the real fix long-term is a dedicated RPC, this is defense in depth.
process.on("unhandledRejection", (reason) => {
  console.error("[runner] unhandled rejection (continuing):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[runner] uncaught exception (continuing):", err);
});

import { connection, runtimeKeypair } from "./connection";
import { CopySubscription, fetchActiveCopySubscriptions } from "./copySubscriptionsClient";
import { ExecutionDriver } from "./driver";
import { MockExecutionDriver } from "./drivers/mockDriver";
import { Pool } from "pg";
import { VelocityExecutionDriver } from "./drivers/velocityDriver";
import { GmxBaseDriver } from "./drivers/gmxBaseDriver";
import { ViperBasePerpDriver } from "./drivers/viperBasePerpDriver";
import { ViperXLayerPerpDriver } from "./drivers/viperXLayerPerpDriver";
import { PaperExecutionDriver } from "./drivers/paperDriver";
import { AgentAccount, RegistryClient } from "./registryClient";
import { createStrategyForAgent } from "./strategies";
import { CopyStrategy } from "./strategies/copyStrategy";
import { MarketSnapshot, Strategy, TradeDecision } from "./strategy";

const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS ?? 15_000);
const MAX_CONSECUTIVE_FAILURES = 3;
const EXECUTION_VENUE = process.env.EXECUTION_VENUE ?? "mock";

// Exported for scripts/verify-circuit-breaker-independence.ts — lets a
// verification script drive the real executeDecision/recordFailure logic
// directly instead of re-implementing it, without changing any runtime
// behavior here.
export interface ManagedAgent {
  agent: AgentAccount;
  strategy: Strategy;
  consecutiveFailures: number;
  disabled: boolean;
}

function createDriver(venue: string): ExecutionDriver {
  const v = venue.toLowerCase();
  if (v === "xlayer" || v === "xlayer-perp" || v === "okx") {
    return new ViperXLayerPerpDriver();
  }
  if (v === "viper" || v === "viperx" || v === "base-perp" || v === "base") {
    return new ViperBasePerpDriver();
  }
  if (v === "velocity" || v === "drift") {
    return new VelocityExecutionDriver();
  }
  if (v === "gmx") {
    return new GmxBaseDriver();
  }
  return new MockExecutionDriver();
}

async function recordFailure(managed: ManagedAgent, registry: RegistryClient, err: unknown): Promise<void> {
  const { agent } = managed;
  managed.consecutiveFailures += 1;
  console.error(
    `[${agent.agentId}] trade failed (${managed.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`,
    err
  );

  if (managed.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    managed.disabled = true;
    try {
      const sig = await registry.authorityPause(agent.publicKey);
      console.error(
        `[${agent.agentId}] circuit breaker tripped — disabled locally and paused on-chain: ${sig}`
      );
    } catch (pauseErr) {
      console.error(
        `[${agent.agentId}] circuit breaker tripped — disabled locally, but authority_pause failed too.`,
        pauseErr
      );
    }
  }
}

/**
 * Executes a single decision for `managed` (open/close/none), then — only if
 * `managed`'s own strategy isn't itself a CopyStrategy, which keeps copy-trade
 * replay single-hop — replays the same decision into every active follower's
 * own ManagedAgent, at the follower's own configured size rather than the
 * source's. Each follower's mirrored attempt runs through this same function
 * recursively, so it gets its own independent success/failure bookkeeping and
 * circuit breaker; one follower's failure can never affect the source's own
 * result or any other follower.
 */
export async function executeDecision(
  driver: ExecutionDriver,
  registry: RegistryClient,
  managed: ManagedAgent,
  decision: TradeDecision,
  snapshot: MarketSnapshot,
  followersBySource: Map<string, CopySubscription[]>,
  managedByPda: Map<string, ManagedAgent>
): Promise<void> {
  if (managed.disabled) return;

  const { agent, strategy } = managed;

  try {
    await driver.switchActiveUser(agent);

    if (decision.action === "open" && decision.side && decision.sizeUsd) {
      // 1. Hard ceiling safety check
      const MAX_POSITION_SIZE_USD = 1000;
      if (decision.sizeUsd > MAX_POSITION_SIZE_USD) {
        console.warn(
          `[Runner][${agent.agentId}] Trade BLOCKED: size $${decision.sizeUsd} exceeds maximum safety limit of $${MAX_POSITION_SIZE_USD}`
        );
        return;
      }

      // 2. Vault balance check
      try {
        const vaultBalance = await driver.getVaultBalance(agent);
        if (vaultBalance > 0 && decision.sizeUsd > vaultBalance) {
          console.warn(
            `[Runner][${agent.agentId}] Trade BLOCKED: size $${decision.sizeUsd} exceeds available vault balance of $${vaultBalance.toFixed(2)}`
          );
          return;
        }
      } catch (balanceErr) {
        console.warn(
          `[Runner][${agent.agentId}] Warning: failed to fetch vault balance for sanity check:`,
          balanceErr
        );
      }

      await driver.openPosition(agent, decision.side, decision.sizeUsd, snapshot, decision.reason);
      strategy.confirmAction(decision);
    } else if (decision.action === "close") {
      await driver.closePosition(agent, snapshot, registry, decision.reason);
      strategy.confirmAction(decision);
    }
    managed.consecutiveFailures = 0;
  } catch (err) {
    await recordFailure(managed, registry, err);
    return;
  }

  if (decision.action === "none" || strategy instanceof CopyStrategy) return;

  const followers = followersBySource.get(agent.publicKey.toBase58());
  if (!followers) return;

  for (const sub of followers) {
    const followerManaged = managedByPda.get(sub.followerAgentPda);
    if (!followerManaged) continue; // follower not managed by this runtime instance

    const mirrored: TradeDecision =
      decision.action === "open"
        ? { action: "open", side: decision.side, sizeUsd: sub.sizeUsd }
        : { action: "close" };

    await executeDecision(driver, registry, followerManaged, mirrored, snapshot, followersBySource, managedByPda);
  }
}

async function handleAgent(
  driver: ExecutionDriver,
  registry: RegistryClient,
  managed: ManagedAgent,
  followersBySource: Map<string, CopySubscription[]>,
  managedByPda: Map<string, ManagedAgent>
): Promise<void> {
  if (managed.disabled) return;
  // CopyStrategy never proposes its own action from price data — it's only
  // ever driven by executeDecision's mirror step, triggered by its source's
  // own tick.
  if (managed.strategy instanceof CopyStrategy) return;

  const { agent, strategy } = managed;

  try {
    await driver.switchActiveUser(agent);
    const marketSymbol = agent.chain === "base" || driver.name.includes("Base") ? "ETH-PERP" : "SOL-PERP";
    const snapshot = await driver.getMarketSnapshot(marketSymbol);
    const decision = await strategy.onTick(snapshot);
    await executeDecision(driver, registry, managed, decision, snapshot, followersBySource, managedByPda);
  } catch (err) {
    await recordFailure(managed, registry, err);
  }
}

async function main(): Promise<void> {
  const registry = new RegistryClient();
  const dbUrl = process.env.DATABASE_URL;
  let pool: Pool | undefined;
  if (dbUrl) {
    pool = new Pool({ connectionString: dbUrl });
  }

  // 1. Load active Devnet agents
  const isBase = EXECUTION_VENUE.toLowerCase() === "base" || EXECUTION_VENUE.toLowerCase() === "gmx";
  let devnetAgents: AgentAccount[] = [];
  if (isBase && pool) {
    devnetAgents = await registry.getManagedActiveBaseAgents(pool);
  } else {
    devnetAgents = await registry.getManagedActiveAgents();
  }

  // 2. Load active Paper agents from Postgres
  let paperAgents: AgentAccount[] = [];
  if (pool) {
    paperAgents = await registry.getManagedActivePaperAgents(pool);
  }

  const devnetDriver = createDriver(EXECUTION_VENUE);
  const paperDriver = new PaperExecutionDriver();
  console.log(`Using Devnet driver: ${devnetDriver.name} (EXECUTION_VENUE=${EXECUTION_VENUE})`);
  console.log(`Using Paper driver: ${paperDriver.name}`);

  // Auto-manage all active devnet agents in Mock/Base mode if none specifically registered
  if (devnetAgents.length === 0) {
    const allActive = isBase && pool
      ? await registry.getAllActiveBaseAgents(pool)
      : await registry.getAllActiveAgents();
    if ((EXECUTION_VENUE.toLowerCase() === "mock" || isBase) && allActive.length > 0) {
      console.log(
        `[Base/MockMode] No devnet agents specifically delegated or managing all active agents directly. ` +
          `Managing all ${allActive.length} active agent(s).`
      );
      devnetAgents = allActive;
    }
  }

  if (devnetAgents.length === 0 && paperAgents.length === 0) {
    console.log("No active devnet or paper agents. Nothing to do.");
    if (pool) await pool.end();
    return;
  }

  console.log(`Managing:`);
  console.log(`- Devnet: ${devnetAgents.length} agent(s) [${devnetAgents.map((a) => a.agentId).join(", ")}]`);
  console.log(`- Paper: ${paperAgents.length} agent(s) [${paperAgents.map((a) => a.agentId).join(", ")}]`);

  if (devnetAgents.length > 0) {
    await devnetDriver.init(devnetAgents);
  }
  if (paperAgents.length > 0) {
    await paperDriver.init(paperAgents);
  }

  const subscriptions = await fetchActiveCopySubscriptions();
  const subscriptionByFollower = new Map<string, CopySubscription>();
  const followersBySource = new Map<string, CopySubscription[]>();
  for (const sub of subscriptions) {
    subscriptionByFollower.set(sub.followerAgentPda, sub);
    const existing = followersBySource.get(sub.sourceAgentPda) ?? [];
    existing.push(sub);
    followersBySource.set(sub.sourceAgentPda, existing);
  }
  if (subscriptions.length > 0) {
    console.log(`Resolved ${subscriptions.length} active copy-trading subscription(s)`);
  }

  const managedDevnet: ManagedAgent[] = [];
  for (const agent of devnetAgents) {
    const copySubscription = subscriptionByFollower.get(agent.publicKey.toBase58());
    const strategy = await createStrategyForAgent(agent, copySubscription);
    await strategy.init();
    console.log(`[${agent.agentId}][Devnet] Assigned strategy: ${strategy.id}`);
    managedDevnet.push({ agent, strategy, consecutiveFailures: 0, disabled: false });
  }

  const managedPaper: ManagedAgent[] = [];
  for (const agent of paperAgents) {
    const copySubscription = subscriptionByFollower.get(agent.publicKey.toBase58());
    const strategy = await createStrategyForAgent(agent, copySubscription);
    await strategy.init();
    console.log(`[${agent.agentId}][Paper] Assigned strategy: ${strategy.id}`);
    managedPaper.push({ agent, strategy, consecutiveFailures: 0, disabled: false });
  }

  const managedByPda = new Map<string, ManagedAgent>();
  for (const m of managedDevnet) {
    managedByPda.set(m.agent.publicKey.toBase58(), m);
  }
  for (const m of managedPaper) {
    managedByPda.set(m.agent.publicKey.toBase58(), m);
  }

  const tick = async () => {
    // Tick Devnet Agents
    for (const m of managedDevnet) {
      await handleAgent(devnetDriver, registry, m, followersBySource, managedByPda);
    }
    // Tick Paper Agents
    for (const m of managedPaper) {
      await handleAgent(paperDriver, registry, m, followersBySource, managedByPda);
    }
  };

  console.log(`Starting tick loop every ${TICK_INTERVAL_MS}ms`);
  await tick();
  setInterval(tick, TICK_INTERVAL_MS);
}

// Guarded so importing executeDecision/ManagedAgent for verification scripts
// (see scripts/verify-circuit-breaker-independence.ts) doesn't also start a
// second, real, concurrent tick loop as a side effect — found live: the
// unguarded top-level call fired on import and produced a second standing
// runner in the same process, competing for the same devnet RPC and driving
// the same agents' accounts.
if (require.main === module) {
  main().catch((err) => {
    console.error("runner failed to start:", err);
    process.exit(1);
  });
}
