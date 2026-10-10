import { MarketSnapshot, Strategy, TradeDecision } from "../strategy";

export interface MomentumConfig {
  /** Ticks held in the rolling window before the strategy will act. */
  windowSize?: number;
  /** Momentum over the window, in basis points, needed to open a position. */
  thresholdBps?: number;
  /** Fixed USD size per position — a stand-in for real position sizing. */
  sizeUsd?: number;
  /**
   * Learned caution (0 upward), raised by pnl-indexer's skillEngine after a
   * string of quick losing trades — widens thresholdBps so the strategy
   * needs a stronger signal before acting again.
   */
  caution?: number;
}

/**
 * Reference strategy: opens long/short once price momentum over a rolling
 * window crosses `thresholdBps`, closes once momentum reverses back through
 * zero. Deliberately simple — this exists to prove the runner -> Drift ->
 * registry pipeline end to end, not as something to trade real money on.
 */
export class MomentumStrategy implements Strategy {
  id = "momentum-v1";

  private prices: number[] = [];
  private position: "long" | "short" | "flat" = "flat";

  private readonly windowSize: number;
  private readonly thresholdBps: number;
  private readonly sizeUsd: number;

  constructor(config: MomentumConfig = {}) {
    this.windowSize = config.windowSize ?? 20;
    this.thresholdBps = (config.thresholdBps ?? 50) * (1 + (config.caution ?? 0)); // 0.50%
    this.sizeUsd = config.sizeUsd ?? 10;
  }

  async init(): Promise<void> {
    this.prices = [];
    this.position = "flat";
  }

  async onTick(snapshot: MarketSnapshot): Promise<TradeDecision> {
    this.prices.push(snapshot.price);
    if (this.prices.length > this.windowSize) this.prices.shift();
    if (this.prices.length < this.windowSize) return { action: "none" };

    const first = this.prices[0];
    const last = this.prices[this.prices.length - 1];
    const momentumBps = ((last - first) / first) * 10_000;

    if (this.position === "flat") {
      if (momentumBps >= this.thresholdBps) {
        return {
          action: "open",
          side: "long",
          sizeUsd: this.sizeUsd,
          reason: `Momentum: +${momentumBps.toFixed(1)} bps >= threshold +${this.thresholdBps.toFixed(1)} bps`
        };
      }
      if (momentumBps <= -this.thresholdBps) {
        return {
          action: "open",
          side: "short",
          sizeUsd: this.sizeUsd,
          reason: `Momentum: ${momentumBps.toFixed(1)} bps <= -threshold -${this.thresholdBps.toFixed(1)} bps`
        };
      }
      return { action: "none" };
    }

    const shouldClose =
      (this.position === "long" && momentumBps <= 0) ||
      (this.position === "short" && momentumBps >= 0);

    if (shouldClose) {
      return {
        action: "close",
        reason: `Momentum reversed: ${momentumBps.toFixed(1)} bps (crossed 0)`
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
  }
}
