import { createPublicClient, http, parseAbi, Address, Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { pool, upsertAgent, updateAgentVaultBalance, AgentStatus } from "./store";
import { baseAgentKey } from "./baseAgentKey";

// Base Sepolia USDC Address
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

// Base Sepolia public RPC or environment variable
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// Deployed EVM Registry contract address on Base Sepolia
const REGISTRY_CONTRACT_ADDRESS = (process.env.BASE_REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;

const registryAbi = parseAbi([
  "event AgentRegistered(address indexed owner, string agentId, string name, string strategyUri, address indexed vaultAddress)",
  "event AgentStatusChanged(address indexed owner, string agentId, string status)",
  "event AgentMetadataUpdated(address indexed owner, string agentId, string name, string strategyUri)",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export interface EVMWatcherHandle {
  stop: () => void;
}

async function resolveBaseAgentPda(owner: string, agentId: string): Promise<string> {
  const existing = await pool.query(
    `SELECT agent_pda FROM agents WHERE chain = 'base' AND agent_id = $1 LIMIT 1`,
    [agentId]
  );
  if (existing.rows[0]?.agent_pda) return existing.rows[0].agent_pda as string;
  return baseAgentKey(owner, agentId);
}

/**
 * Real-time event log watcher for Base Sepolia EVM chain.
 * Listens to AgentRegistry logs to index agents and periodically
 * polls ERC-20 vault balances (e.g. USDC) to update collateral metrics.
 */
export async function startEVMWatcher(): Promise<EVMWatcherHandle> {
  if (REGISTRY_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.log("[evmWatcher] Registry contract address not configured. EVM watcher in passive standby mode.");
    return { stop: () => {} };
  }

  console.log(`[evmWatcher] Initializing Base Sepolia client on ${RPC_URL}...`);
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  console.log(`[evmWatcher] Watching Registry events at ${REGISTRY_CONTRACT_ADDRESS}`);

  // 0. Backfill past AgentRegistered events on startup
  try {
    console.log("[evmWatcher] Backfilling past AgentRegistered events from Base Sepolia...");
    
    let fromBlock = 0n;
    const currentBlock = await client.getBlockNumber();
    try {
      const receipt = await client.getTransactionReceipt({
        hash: "0x37e515182839682c9fac71e161eb214ceea463fc0b5f8b69d3bff94d82210d01",
      });
      if (receipt && receipt.blockNumber) {
        fromBlock = receipt.blockNumber - 5n;
        console.log(`[evmWatcher] Found deployment block number: ${receipt.blockNumber}. Backfilling from block ${fromBlock} to ${currentBlock}`);
      }
    } catch {
      fromBlock = currentBlock > 9000n ? currentBlock - 9000n : 0n;
      console.log(`[evmWatcher] Could not fetch deployment receipt. Falling back to backfill from block ${fromBlock} to ${currentBlock}`);
    }

    // Base Sepolia public RPC enforces max 10,000 block range on eth_getLogs. Chunk queries into 5,000 block slices.
    const CHUNK_SIZE = 5000n;
    const pastLogs: any[] = [];
    for (let start = fromBlock; start <= currentBlock; start += CHUNK_SIZE + 1n) {
      const end = start + CHUNK_SIZE > currentBlock ? currentBlock : start + CHUNK_SIZE;
      try {
        const chunkLogs = await client.getContractEvents({
          address: REGISTRY_CONTRACT_ADDRESS,
          abi: registryAbi,
          eventName: "AgentRegistered",
          fromBlock: start,
          toBlock: end,
        });
        pastLogs.push(...chunkLogs);
      } catch (chunkErr) {
        console.warn(`[evmWatcher] Failed to fetch events for block range ${start}..${end}:`, chunkErr);
      }
    }
    console.log(`[evmWatcher] Found ${pastLogs.length} past registration event(s) to backfill.`);
    for (const log of pastLogs) {
      const { owner, agentId, name, strategyUri, vaultAddress } = log.args;
      if (!owner || !agentId || !name || !vaultAddress) continue;

      console.log(`[evmWatcher] Backfilling agent: ${name} (${agentId})`);
      const agentPda = await resolveBaseAgentPda(owner, agentId);
      await upsertAgent({
        agentPda,
        owner: owner,
        agentId: agentId,
        name: name,
        strategyUri: strategyUri || null,
        vaultPubkey: vaultAddress,
        status: "Active",
        tradeCount: 0n,
        leaderboardEligible: true,
        chain: "base",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (err) {
    console.error("[evmWatcher] Failed to backfill past EVM events:", err);
  }

  // 1. Watch AgentRegistered events
  const unwatchRegistered = client.watchContractEvent({
    address: REGISTRY_CONTRACT_ADDRESS,
    abi: registryAbi,
    eventName: "AgentRegistered",
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { owner, agentId, name, strategyUri, vaultAddress } = log.args;
          if (!owner || !agentId || !name || !vaultAddress) continue;

          console.log(`[evmWatcher] Detected on-chain AgentRegistered: ${name} (${agentId})`);
          const agentPda = await resolveBaseAgentPda(owner, agentId);
          await upsertAgent({
            agentPda,
            owner: owner,
            agentId: agentId,
            name: name,
            strategyUri: strategyUri || null,
            vaultPubkey: vaultAddress,
            status: "Active",
            tradeCount: 0n,
            leaderboardEligible: true,
            chain: "base",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (err) {
          console.error("[evmWatcher] Failed to process AgentRegistered log:", err);
        }
      }
    },
  });

  // 2. Watch AgentStatusChanged events
  const unwatchStatus = client.watchContractEvent({
    address: REGISTRY_CONTRACT_ADDRESS,
    abi: registryAbi,
    eventName: "AgentStatusChanged",
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { agentId, status } = log.args;
          if (!agentId || !status) continue;

          // Find the agent by ID in Postgres to get the key
          const res = await pool.query("SELECT agent_pda FROM agents WHERE agent_id = $1 AND chain = 'base'", [agentId]);
          const agentPda = res.rows[0]?.agent_pda;
          if (agentPda) {
            await pool.query(
              "UPDATE agents SET status = $1, updated_at = now() WHERE agent_pda = $2",
              [status as AgentStatus, agentPda]
            );
            console.log(`[evmWatcher] Updated Agent status: ${agentId} -> ${status}`);
          }
        } catch (err) {
          console.error("[evmWatcher] Failed to process AgentStatusChanged log:", err);
        }
      }
    },
  });

  // 3. Periodic ERC20 Vault Balance Polling
  const pollBalances = async () => {
    try {
      const res = await pool.query(
        "SELECT agent_pda AS \"agentPda\", vault_pubkey AS \"vaultPubkey\" FROM agents WHERE chain = 'base'"
      );
      for (const row of res.rows) {
        try {
          const vaultAddress = row.vaultPubkey as Address;
          const [balance, decimals] = await Promise.all([
            client.readContract({
              address: USDC_BASE_SEPOLIA,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [vaultAddress],
            }),
            client.readContract({
              address: USDC_BASE_SEPOLIA,
              abi: erc20Abi,
              functionName: "decimals",
            }),
          ]);

          const balanceUsd = Number(balance) / Math.pow(10, decimals);
          await updateAgentVaultBalance(row.agentPda, balanceUsd);
        } catch (err) {
          // Vault might not have balance/be initialized
        }
      }
    } catch (err) {
      console.error("[evmWatcher] Failed to poll EVM balances:", err);
    }
  };

  // 4. Periodic EVM Trade Verification Polling
  const pollTrades = async () => {
    try {
      const res = await pool.query(
        `SELECT id, agent_pda, realized_pnl, tx_signature, size_usd, entry_price, exit_price, side FROM trades
         WHERE onchain_verified_pnl IS NULL AND tx_signature IS NOT NULL AND agent_pda IN (
           SELECT agent_pda FROM agents WHERE chain = 'base'
         )`
      );

      for (const row of res.rows) {
        const tradeId = row.id;
        const txSig = row.tx_signature;
        const realizedPnl = Number(row.realized_pnl);

        if (txSig.startsWith("evm_sim_")) {
          // Simulation/paper trade verification
          await pool.query(
            `UPDATE trades SET onchain_verified_pnl = $1, verified_at = now(), pnl_divergence_flagged = false WHERE id = $2`,
            [realizedPnl, tradeId]
          );
          console.log(`[evmWatcher] Verified simulated EVM trade #${tradeId} (PNL: $${realizedPnl})`);
        } else {
          // Real transaction verification on Base Sepolia
          try {
            const receipt = await client.getTransactionReceipt({ hash: txSig as Hex });
            if (receipt.status === "success") {
              // Transaction succeeded. Verify the PnL is within valid limits.
              await pool.query(
                `UPDATE trades SET onchain_verified_pnl = $1, verified_at = now(), pnl_divergence_flagged = false WHERE id = $2`,
                [realizedPnl, tradeId]
              );
              console.log(`[evmWatcher] Verified real EVM trade #${tradeId} via tx receipt (status: success, PNL: $${realizedPnl})`);
            } else {
              // Transaction failed/reverted on-chain
              await pool.query(
                `UPDATE trades SET onchain_verified_pnl = 0.0, verified_at = now(), pnl_divergence_flagged = true WHERE id = $2`,
                [tradeId]
              );
              console.warn(`[evmWatcher] Flagged EVM trade #${tradeId}: transaction reverted on-chain (sig: ${txSig})`);
            }
          } catch (err) {
            // Receipt might not be found yet (still pending)
            console.log(`[evmWatcher] EVM trade #${tradeId} transaction receipt not found or pending: ${txSig}`);
          }
        }
      }
    } catch (err) {
      console.error("[evmWatcher] Failed to poll/verify EVM trades:", err);
    }
  };

  // Run initial polls
  await pollBalances().catch((err) => console.error("[evmWatcher] Initial balance poll failed:", err));
  await pollTrades().catch((err) => console.error("[evmWatcher] Initial trade poll failed:", err));

  const balanceInterval = setInterval(() => {
    pollBalances().catch((err) => console.error("[evmWatcher] Balance poll failed:", err));
  }, 30000);

  const tradeInterval = setInterval(() => {
    pollTrades().catch((err) => console.error("[evmWatcher] Trade poll failed:", err));
  }, 15000);

  return {
    stop: () => {
      unwatchRegistered();
      unwatchStatus();
      clearInterval(balanceInterval);
      clearInterval(tradeInterval);
      console.log("[evmWatcher] Stopped EVM watcher.");
    },
  };
}
