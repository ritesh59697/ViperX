import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { ViperVaultAbi, PositionRouterAbi } from "./abis";
import { RPC_URL, KEEPER_PRIVATE_KEY, VAULT_ADDRESS, ROUTER_ADDRESS, POLL_INTERVAL_MS } from "./config";

const account = privateKeyToAccount(KEEPER_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// In-memory tracked active positions & triggers
const activePositionKeys = new Set<`0x${string}`>();
const activeOrderIds = new Set<`0x${string}`>();
let lastBorrowUpdate = 0;

async function updateBorrowRateCrank() {
  const now = Date.now();
  // Call updateBorrowIndex once every hour
  if (now - lastBorrowUpdate > 60 * 60 * 1000) {
    try {
      console.log("[Keeper] Accruing pool borrow interest on-chain...");
      const tx = await walletClient.writeContract({
        address: VAULT_ADDRESS,
        abi: ViperVaultAbi,
        functionName: "updateBorrowIndex",
      });
      console.log(`[Keeper] ✅ Borrow index updated. Tx: ${tx}`);
      lastBorrowUpdate = now;
    } catch (err: any) {
      console.error("[Keeper] Error updating borrow index:", err?.message || err);
    }
  }
}

async function checkLiquidations() {
  for (const posKey of activePositionKeys) {
    try {
      // Simulate liquidation call: if it succeeds without reverting, position is underwater!
      const { result } = await publicClient.simulateContract({
        address: VAULT_ADDRESS,
        abi: ViperVaultAbi,
        functionName: "liquidatePosition",
        args: [posKey],
        account,
      });

      console.log(`[Keeper] 🚨 Underwater position detected! Liquidating ${posKey}... Expected bounty: $${Number(result) / 1e18}`);
      const tx = await walletClient.writeContract({
        address: VAULT_ADDRESS,
        abi: ViperVaultAbi,
        functionName: "liquidatePosition",
        args: [posKey],
      });
      console.log(`[Keeper] ✅ Liquidation successful! Tx: ${tx}`);
      activePositionKeys.delete(posKey);
    } catch {
      // Position is healthy; simulation reverted with PositionNotLiquidatable
    }
  }
}

async function checkTriggerOrders() {
  for (const orderId of activeOrderIds) {
    try {
      // Simulate trigger execution
      await publicClient.simulateContract({
        address: ROUTER_ADDRESS,
        abi: PositionRouterAbi,
        functionName: "executeTriggerOrder",
        args: [orderId],
        account,
      });

      console.log(`[Keeper] ⚡ Limit/Stop-Loss trigger reached! Executing order ${orderId}...`);
      const tx = await walletClient.writeContract({
        address: ROUTER_ADDRESS,
        abi: PositionRouterAbi,
        functionName: "executeTriggerOrder",
        args: [orderId],
      });
      console.log(`[Keeper] ✅ Trigger order executed! Tx: ${tx}`);
      activeOrderIds.delete(orderId);
    } catch {
      // Trigger threshold not reached yet
    }
  }
}

async function pollEvents() {
  try {
    const blockNumber = await publicClient.getBlockNumber();
    const fromBlock = blockNumber > 100n ? blockNumber - 100n : 0n;

    // Track newly opened positions
    const openLogs = await publicClient.getLogs({
      address: VAULT_ADDRESS,
      event: {
        type: "event",
        name: "PositionOpened",
        inputs: ViperVaultAbi.find(x => x.name === "PositionOpened")!.inputs,
      },
      fromBlock,
    });

    for (const log of openLogs) {
      if (log.args.positionKey) {
        activePositionKeys.add(log.args.positionKey);
      }
    }

    // Untrack closed positions
    const closeLogs = await publicClient.getLogs({
      address: VAULT_ADDRESS,
      event: {
        type: "event",
        name: "PositionClosed",
        inputs: ViperVaultAbi.find(x => x.name === "PositionClosed")!.inputs,
      },
      fromBlock,
    });

    for (const log of closeLogs) {
      if (log.args.positionKey) {
        activePositionKeys.delete(log.args.positionKey);
      }
    }
  } catch (err: any) {
    console.error("[Keeper] Error polling on-chain events:", err?.message || err);
  }
}

async function startKeeperDaemon() {
  console.log("==================================================");
  console.log("⚡ ViperX Autonomous Perp Keeper Daemon Started");
  console.log(`📍 Keeper Address: ${account.address}`);
  console.log(`🏛️ Vault Address:  ${VAULT_ADDRESS}`);
  console.log(`🔄 Polling Rate:   ${POLL_INTERVAL_MS}ms`);
  console.log("==================================================");

  while (true) {
    await pollEvents();
    await checkLiquidations();
    await checkTriggerOrders();
    await updateBorrowRateCrank();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (require.main === module) {
  startKeeperDaemon().catch((err) => {
    console.error("[Keeper] Fatal crash:", err);
    process.exit(1);
  });
}
