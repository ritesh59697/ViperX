import { MarketSnapshot, Strategy, TradeDecision } from "../strategy";

export interface GridConfig {
  gridSpacingBps?: number; // e.g. 30 bps (0.3%) per grid level
  sizeUsd?: number;
  /** Learned caution (0 upward) — see MomentumConfig's doc comment. */
  caution?: number;
}

export class GridTradingStrategy implements Strategy {
  id = "grid-v1";

  private basePrice: number | null = null;
  private position: "long" | "short" | "flat" = "flat";
  private lastTradePrice: number = 0;
  // Set in onTick when proposing a decision, applied in confirmAction once
  // the driver call actually succeeds — see confirmAction's doc comment.
  private pendingTradePrice: number | null = null;

  private readonly gridSpacingBps: number;
  private readonly sizeUsd: number;

  constructor(config: GridConfig = {}) {
    this.gridSpacingBps = (config.gridSpacingBps ?? 30) * (1 + (config.caution ?? 0));
    this.sizeUsd = config.sizeUsd ?? 30;
  }

  async init(): Promise<void> {
    this.basePrice = null;
    this.position = "flat";
    this.lastTradePrice = 0;
    this.pendingTradePrice = null;
  }

  async onTick(snapshot: MarketSnapshot): Promise<TradeDecision> {
    if (this.basePrice === null) {
      this.basePrice = snapshot.price;
      this.lastTradePrice = snapshot.price;
      return { action: "none" };
    }

    const priceDiffBps = ((snapshot.price - this.lastTradePrice) / this.lastTradePrice) * 10_000;

    if (this.position === "flat") {
      // Price dropped below grid level -> Buy dip (Long)
      if (priceDiffBps <= -this.gridSpacingBps) {
        this.pendingTradePrice = snapshot.price;
        return {
          action: "open",
          side: "long",
          sizeUsd: this.sizeUsd,
          reason: `Grid: Price dip of ${Math.abs(priceDiffBps).toFixed(1)} bps >= spacing ${this.gridSpacingBps.toFixed(1)} bps`
        };
      }
      // Price rose above grid level -> Sell spike (Short)
      if (priceDiffBps >= this.gridSpacingBps) {
        this.pendingTradePrice = snapshot.price;
        return {
          action: "open",
          side: "short",
          sizeUsd: this.sizeUsd,
          reason: `Grid: Price spike of +${priceDiffBps.toFixed(1)} bps >= spacing ${this.gridSpacingBps.toFixed(1)} bps`
        };
      }
      return { action: "none" };
    }

    // Close when price moves back by 1 grid interval in profit direction
    const profitMoveBps =
      this.position === "long"
        ? ((snapshot.price - this.lastTradePrice) / this.lastTradePrice) * 10_000
        : ((this.lastTradePrice - snapshot.price) / this.lastTradePrice) * 10_000;

    if (profitMoveBps >= this.gridSpacingBps) {
      this.pendingTradePrice = snapshot.price;
      return {
        action: "close",
        reason: `Grid Exit: Profit target of +${profitMoveBps.toFixed(1)} bps >= spacing ${this.gridSpacingBps.toFixed(1)} bps`
      };
    }

    return { action: "none" };
  }

  confirmAction(decision: TradeDecision): void {
    if (decision.action === "open") {
      this.position = decision.side;
    } else if (decision.action === "close") {
      this.position = "flat";
    }
    if (this.pendingTradePrice !== null) {
      this.lastTradePrice = this.pendingTradePrice;
      this.pendingTradePrice = null;
    }
  }
}
