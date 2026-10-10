import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEventLogs,
  parseUnits,
  formatUnits,
  keccak256,
  stringToBytes,
  type Address,
  type Hex,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { Pool } from "pg";
import { ExecutionDriver } from "../driver";
import { AgentAccount, RegistryClient, solanaToEvmAddress } from "../registryClient";
import { MarketSnapshot } from "../strategy";
import { recordClosedTrade } from "../pnlWrite";

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const VAULT_ADDRESS = (process.env.BASE_VIPER_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;

const viperVaultAbi = parseAbi([
  "function openPosition(bytes32 marketId, uint8 side, uint256 sizeUsd, uint256 collateralUsd) external returns (bytes32)",
  "function closePosition(bytes32 positionKey) external returns (int256 realizedPnlUsd, uint256 payoutUsd)",
  "function getPositionKey(address trader, bytes32 marketId, uint8 side) external view returns (bytes32)",
  "function positions(bytes32 positionKey) external view returns (address trader, bytes32 marketId, uint8 side, uint256 sizeUsd, uint256 collateralUsd, uint256 entryPrice, uint256 entryBorrowIndex, uint256 openedAt)",
  "function markets(bytes32 marketId) external view returns (bool isActive, bytes32 pythPriceFeedId, uint256, uint256, uint256, uint256, uint256 minPositionSizeUsd, uint256 maxLeverageBps, uint256)",
  "function priceAdapter() external view returns (address)",
  "function poolCollateralUsd() external view returns (uint256)",
  "event PositionOpened(bytes32 indexed positionKey, address indexed trader, bytes32 indexed marketId, uint8 side, uint256 sizeUsd, uint256 collateralUsd, uint256 entryPrice)",
  "event PositionClosed(bytes32 indexed positionKey, address indexed trader, bytes32 indexed marketId, uint8 side, uint256 sizeUsd, uint256 exitPrice, int256 realizedPnlUsd, uint256 netPayoutUsd)",
]);

const priceAdapterAbi = parseAbi([
  "function getNormalizedPrice(bytes32 feedId) view returns (uint256)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

interface BasePosition {
  side: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  openedAt: number;
  entryReason?: string;
  positionKey?: Hex;
}

function marketIdFromSymbol(symbol: string): Hex {
  return keccak256(stringToBytes(symbol));
}

function agentRecordKey(agent: AgentAccount): string {
  const buf = agent.publicKey.toBuffer();
  const isPaddedEvm = buf.subarray(0, 12).every((b) => b === 0);
  return isPaddedEvm ? solanaToEvmAddress(agent.publicKey) : agent.publicKey.toBase58();
}

export class ViperBasePerpDriver implements ExecutionDriver {
  name = "ViperX Native Perps (Base Sepolia)";
  private publicClient;
  private walletClient;
  private account?: Account;
  private pool?: Pool;
  private openPositions = new Map<string, BasePosition>();

  constructor() {
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(RPC_URL),
    });

    const privKey = process.env.BASE_PRIVATE_KEY as Hex | undefined;
    if (privKey) {
      this.account = privateKeyToAccount(privKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain: baseSepolia,
        transport: http(RPC_URL),
      });
    }
  }

  async init(_agents: AgentAccount[]): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.pool = new Pool({ connectionString: dbUrl });
    }
    if (!this.walletClient || VAULT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      throw new Error(
        "[ViperBasePerpDriver] BASE_PRIVATE_KEY and BASE_VIPER_VAULT_ADDRESS are required — simulated fills are disabled."
      );
    }
    console.log(`[ViperBasePerpDriver] Initialized. Trader: ${this.account?.address}`);
  }

  async getMarketSnapshot(marketSymbol: string): Promise<MarketSnapshot> {
    const adapter = (await this.publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: viperVaultAbi,
      functionName: "priceAdapter",
    })) as Address;

    const market = await this.publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: viperVaultAbi,
      functionName: "markets",
      args: [marketIdFromSymbol(marketSymbol)],
    });

    if (!market[0]) {
      throw new Error(`[ViperBasePerpDriver] Market ${marketSymbol} is not active`);
    }

    const priceUsd18 = await this.publicClient.readContract({
      address: adapter,
      abi: priceAdapterAbi,
      functionName: "getNormalizedPrice",
      args: [market[1]],
    });

    return {
      marketSymbol,
      price: Number(formatUnits(priceUsd18, 18)),
      timestamp: Date.now(),
    };
  }

  async switchActiveUser(_agent: AgentAccount): Promise<void> {}

  private trader(): Address {
    if (!this.account) throw new Error("[ViperBasePerpDriver] No signer");
    return this.account.address;
  }

  private async ensureUsdcAllowance(rawUsdc: bigint): Promise<void> {
    const owner = this.trader();
    const current = await this.publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, VAULT_ADDRESS],
    });
    if (current >= rawUsdc) return;

    const hash = await this.walletClient!.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [VAULT_ADDRESS, rawUsdc],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }

  async openPosition(
    agent: AgentAccount,
    side: "long" | "short",
    sizeUsd: number,
    snapshot: MarketSnapshot,
    reason?: string
  ): Promise<{ sig?: string }> {
    const agentKey = agentRecordKey(agent);
    const marketId = marketIdFromSymbol(snapshot.marketSymbol || "ETH-PERP");
    const collateralUsd = Math.max(sizeUsd / 3, 0.2);
    const sizeWei = parseUnits(sizeUsd.toFixed(2), 18);
    const collateralWei = parseUnits(collateralUsd.toFixed(2), 18);
    const rawUsdc = parseUnits(collateralUsd.toFixed(2), 6);

    const usdcBal = await this.publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [this.trader()],
    });
    if (usdcBal < rawUsdc) {
      throw new Error(
        `[ViperBasePerpDriver] Trader USDC ${formatUnits(usdcBal, 6)} < collateral ${formatUnits(rawUsdc, 6)}`
      );
    }

    await this.ensureUsdcAllowance(rawUsdc);

    const sideEnum = side === "long" ? 0 : 1;
    console.log(
      `[ViperBasePerpDriver] Opening ${side.toUpperCase()} $${sizeUsd} on ${snapshot.marketSymbol} as ${this.trader()}`
    );

    const txHash = await this.walletClient!.writeContract({
      address: VAULT_ADDRESS,
      abi: viperVaultAbi,
      functionName: "openPosition",
      args: [marketId, sideEnum, sizeWei, collateralWei],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`[ViperBasePerpDriver] openPosition reverted: ${txHash}`);
    }

    const opened = parseEventLogs({
      abi: viperVaultAbi,
      logs: receipt.logs,
      eventName: "PositionOpened",
    })[0];
    if (!opened) {
      throw new Error(`[ViperBasePerpDriver] openPosition mined but no PositionOpened log: ${txHash}`);
    }
    const positionKey = opened.args.positionKey;
    const entryPrice = Number(formatUnits(opened.args.entryPrice, 18));

    console.log(`[ViperBasePerpDriver] Opened ${txHash} @ $${entryPrice.toFixed(2)}`);

    this.openPositions.set(agentKey, {
      side,
      sizeUsd,
      entryPrice,
      openedAt: Date.now(),
      entryReason: reason,
      positionKey,
    });

    return { sig: txHash };
  }

  async closePosition(
    agent: AgentAccount,
    snapshot: MarketSnapshot,
    _registry: RegistryClient,
    reason?: string
  ): Promise<{ sig?: string }> {
    const agentKey = agentRecordKey(agent);
    const pos = this.openPositions.get(agentKey);
    if (!pos) {
      throw new Error(`[ViperBasePerpDriver] No open position for ${agent.name}`);
    }

    const marketId = marketIdFromSymbol(snapshot.marketSymbol || "ETH-PERP");
    const sideEnum = pos.side === "long" ? 0 : 1;
    const positionKey =
      pos.positionKey ??
      (await this.publicClient.readContract({
        address: VAULT_ADDRESS,
        abi: viperVaultAbi,
        functionName: "getPositionKey",
        args: [this.trader(), marketId, sideEnum],
      }));

    console.log(`[ViperBasePerpDriver] Closing ${pos.side.toUpperCase()} for ${agent.name}`);

    const txHash = await this.walletClient!.writeContract({
      address: VAULT_ADDRESS,
      abi: viperVaultAbi,
      functionName: "closePosition",
      args: [positionKey],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`[ViperBasePerpDriver] closePosition reverted: ${txHash}`);
    }

    console.log(`[ViperBasePerpDriver] Closed ${txHash}`);

    if (this.pool) {
      try {
        await recordClosedTrade(this.pool, {
          agentPda: agentKey,
          marketSymbol: snapshot.marketSymbol || "ETH-PERP",
          side: pos.side,
          sizeUsd: pos.sizeUsd,
          entryPrice: pos.entryPrice,
          exitPrice: snapshot.price,
          openedAt: pos.openedAt,
          txSignature: txHash,
          reason: reason || pos.entryReason || "ViperX Native Base Perp Strategy",
        });
      } catch (err) {
        console.error(`[ViperBasePerpDriver] Failed to record trade in DB:`, err);
      }
    }

    this.openPositions.delete(agentKey);
    return { sig: txHash };
  }

  async getVaultBalance(_agent: AgentAccount): Promise<number> {
    const raw = await this.publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [this.trader()],
    });
    return Number(formatUnits(raw, 6));
  }
}
