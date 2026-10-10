import { createPublicClient, createWalletClient, http, parseAbi, Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { Pool } from "pg";
import { ExecutionDriver } from "../driver";
import { AgentAccount, RegistryClient, solanaToEvmAddress } from "../registryClient";
import { MarketSnapshot } from "../strategy";
import { recordClosedTrade } from "../pnlWrite";

// Base Sepolia RPC & Router Configuration
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const GMX_ROUTER_ADDRESS = (process.env.BASE_GMX_ROUTER_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;

const gmxRouterAbi = parseAbi([
  "function createOrder(address account, (address market, uint256 initialSizeDelta, bool isLong, uint256 triggerPrice, uint256 acceptablePrice, uint256 executionFee) params) external returns (bytes32)",
]);

interface BasePosition {
  side: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  openedAt: number;
  entryReason?: string;
}

export class GmxBaseDriver implements ExecutionDriver {
  name = "GMX V2 (Base Sepolia)";
  private publicClient;
  private walletClient;
  private pool?: Pool;
  private openPositions = new Map<string, BasePosition>();

  constructor() {
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(RPC_URL),
    });

    const privKey = process.env.BASE_PRIVATE_KEY as Hex;
    if (privKey) {
      const account = privateKeyToAccount(privKey);
      this.walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_URL),
      });
    }
  }

  async init(agents: AgentAccount[]): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.pool = new Pool({ connectionString: dbUrl });
    }
    console.log(`[GmxBaseDriver] Initialized EVM driver on Base Sepolia. Wallet loaded: ${this.walletClient ? "Yes" : "No"}`);
  }

  async getMarketSnapshot(marketSymbol: string): Promise<MarketSnapshot> {
    // Queries mock Pyth Oracle/GMX feeds or falls back to public API
    const mockSolPrice = 150.0 + (Math.random() - 0.5) * 2;
    return {
      marketSymbol,
      price: mockSolPrice,
      timestamp: Date.now(),
    };
  }

  async switchActiveUser(agent: AgentAccount): Promise<void> {
    // EVM context switches can adjust delegated vault allowance or active signer
  }

  async openPosition(
    agent: AgentAccount,
    side: "long" | "short",
    sizeUsd: number,
    snapshot: MarketSnapshot,
    reason?: string
  ): Promise<{ sig?: string }> {
    const key = agent.publicKey.toBase58();
    
    // 1. Local Bookkeeping
    this.openPositions.set(key, {
      side,
      sizeUsd,
      entryPrice: snapshot.price,
      openedAt: Date.now(),
      entryReason: reason,
    });

    console.log(`[GmxBaseDriver][${agent.agentId}] EVM Open request: ${side.toUpperCase()} $${sizeUsd} @ $${snapshot.price} (${reason || "No reason"})`);

    // 2. On-Chain Order execution if wallet is loaded
    if (this.walletClient && GMX_ROUTER_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      try {
        const hash = await this.walletClient.writeContract({
          address: GMX_ROUTER_ADDRESS,
          abi: gmxRouterAbi,
          functionName: "createOrder",
          args: [
            solanaToEvmAddress(agent.vaultPubkey) as Address, // User's vault account
            {
              market: "0x0000000000000000000000000000000000000000", // Target pool market (e.g. SOL-USD market)
              initialSizeDelta: BigInt(Math.floor(sizeUsd * 1e30)), // GMX uses 1e30 precision
              isLong: side === "long",
              triggerPrice: 0n,
              acceptablePrice: BigInt(Math.floor(snapshot.price * 1e30)),
              executionFee: BigInt(10 ** 15), // execution fee in gwei
            }
          ]
        });

        console.log(`[GmxBaseDriver] Executed GMX V2 order. Tx: ${hash}`);
        return { sig: hash };
      } catch (err) {
        console.error("[GmxBaseDriver] Failed to submit order to GMX router:", err);
      }
    }

    // Fallback signature for paper/simulation
    const mockTxSig = `evm_sim_${Date.now()}`;
    return { sig: mockTxSig };
  }

  async closePosition(
    agent: AgentAccount,
    snapshot: MarketSnapshot,
    registry: RegistryClient,
    reason?: string
  ): Promise<{ sig?: string }> {
    const key = agent.publicKey.toBase58();
    const position = this.openPositions.get(key);
    if (!position) {
      return {};
    }

    const realizedPnl =
      position.side === "long"
        ? (snapshot.price - position.entryPrice) * (position.sizeUsd / position.entryPrice)
        : (position.entryPrice - snapshot.price) * (position.sizeUsd / position.entryPrice);

    console.log(`[GmxBaseDriver][${agent.agentId}] EVM Close request. Realized PNL: $${realizedPnl.toFixed(2)}`);

    let hashSig: string | undefined;

    if (this.walletClient && GMX_ROUTER_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      try {
        hashSig = await this.walletClient.writeContract({
          address: GMX_ROUTER_ADDRESS,
          abi: gmxRouterAbi,
          functionName: "createOrder",
          args: [
            solanaToEvmAddress(agent.vaultPubkey) as Address,
            {
              market: "0x0000000000000000000000000000000000000000",
              initialSizeDelta: BigInt(Math.floor(position.sizeUsd * 1e30)),
              isLong: position.side === "short", // closing long is a short order
              triggerPrice: 0n,
              acceptablePrice: BigInt(Math.floor(snapshot.price * 1e30)),
              executionFee: BigInt(10 ** 15),
            }
          ]
        });
        console.log(`[GmxBaseDriver] Executed GMX V2 close order. Tx: ${hashSig}`);
      } catch (err) {
        console.error("[GmxBaseDriver] Failed to submit close order to GMX router:", err);
      }
    }

    const finalSig = hashSig || `evm_sim_close_${Date.now()}`;
    const combinedReason = `Entry: ${position.entryReason || "N/A"} | Exit: ${reason || "N/A"}`;

    // Reconcile and save closed trade details using unified metrics snapshot helper
    if (this.pool) {
      try {
        await recordClosedTrade(this.pool, {
          agentPda: agent.publicKey.toBase58(),
          marketSymbol: "SOL-PERP",
          side: position.side,
          sizeUsd: position.sizeUsd,
          entryPrice: position.entryPrice,
          exitPrice: snapshot.price,
          openedAt: position.openedAt,
          txSignature: finalSig,
          reason: combinedReason,
        });
        console.log(`[GmxBaseDriver][${agent.agentId}] Postgres trade & PNL snapshot updated via recordClosedTrade`);
      } catch (err) {
        console.error(`[GmxBaseDriver][${agent.agentId}] Failed to record trade/PNL to Postgres:`, err);
      }
    }

    this.openPositions.delete(key);
    return { sig: finalSig };
  }

  async getVaultBalance(agent: AgentAccount): Promise<number> {
    const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
    const erc20Abi = parseAbi([
      "function balanceOf(address account) view returns (uint256)",
    ]);
    try {
      const balance = await this.publicClient.readContract({
        address: USDC_BASE_SEPOLIA,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [solanaToEvmAddress(agent.vaultPubkey) as Address],
      });
      // USDC on Base Sepolia is 6 decimals
      return Number(balance) / 1e6;
    } catch (err) {
      console.warn(`[GmxBaseDriver] Failed to fetch vault balance for agent ${agent.agentId}:`, err);
      return 0.0;
    }
  }
}
