import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import http from "http";
import { registryProgram } from "./connection";
import { backfillAgents, subscribeToRegistryEvents } from "./registryListener";
import { startSkillEngine } from "./skillEngine";
import { getAgentCount, pool } from "./store";
import { syncAllMetrics } from "./tradeIndexer";
import { startVelocityWatcher } from "./velocityWatcher";
import { startEVMWatcher } from "./evmWatcher";

// Prevent transient RPC connection errors (e.g. ECONNREFUSED, fetch failed, 429s) from crashing the container
process.on("unhandledRejection", (reason) => {
  console.error("[pnl-indexer] Unhandled Rejection (non-fatal, process continuing):", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[pnl-indexer] Uncaught Exception (non-fatal, process continuing):", err);
});

async function main(): Promise<void> {
  const port = process.env.PORT || 8080;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() }));
  });
  server.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
  });

  console.log("Backfilling existing agents from the registry...");
  const { upserted, skippedStale } = await backfillAgents();
  console.log(
    `  backfilled ${upserted} agent(s)` +
      (skippedStale > 0 ? `, skipped ${skippedStale} stale pre-fix account(s)` : "") +
      `. Postgres now has ${await getAgentCount()} agent row(s).`
  );

  await syncAllMetrics();

  const listeners = subscribeToRegistryEvents();
  console.log(`Listening for registry events (${listeners.length} subscriptions active)...`);

  const velocityWatcher = await startVelocityWatcher();
  const evmWatcher = await startEVMWatcher();
  const skillEngine = await startSkillEngine();

  const shutdown = async () => {
    console.log("\nShutting down...");
    server.close();
    velocityWatcher.stop();
    evmWatcher.stop();
    skillEngine.stop();
    await Promise.all(listeners.map((id) => registryProgram.removeEventListener(id)));
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("pnl-indexer failed to start:", err);
  process.exit(1);
});
