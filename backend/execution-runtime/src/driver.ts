import { AgentAccount, RegistryClient } from "./registryClient";
import { MarketSnapshot } from "./strategy";

export interface TradeDecision {
  action: "open" | "close" | "hold";
  side?: "long" | "short";
  sizeUsd?: number;
}

export interface ExecutionDriver {
  /** Name of the driver for logging/diagnostics */
  name: string;

  /** Initialize the driver for the set of managed agents */
  init(agents: AgentAccount[]): Promise<void>;

  /** Fetch current market price snapshot for a symbol (e.g. "SOL-PERP") */
  getMarketSnapshot(marketSymbol: string): Promise<MarketSnapshot>;

  /** Point driver context at the target agent before trade actions */
  switchActiveUser(agent: AgentAccount): Promise<void>;

  /** Open a perp position */
  openPosition(
    agent: AgentAccount,
    side: "long" | "short",
    sizeUsd: number,
    snapshot: MarketSnapshot,
    reason?: string
  ): Promise<{ sig?: string }>;

  /** Close an existing perp position */
  closePosition(
    agent: AgentAccount,
    snapshot: MarketSnapshot,
    registry: RegistryClient,
    reason?: string
  ): Promise<{ sig?: string }>;

  /** Get the current vault balance of the agent in USD */
  getVaultBalance(agent: AgentAccount): Promise<number>;
}
