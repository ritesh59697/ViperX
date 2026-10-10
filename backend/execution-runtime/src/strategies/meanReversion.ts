import { MarketSnapshot, Strategy, TradeDecision } from "../strategy";

export interface MeanReversionConfig {
  windowSize?: number;
  rsiLowerThreshold?: number; // Oversold threshold (e.g. 35) -> Open Long
  rsiUpperThreshold?: number; // Overbought threshold (e.g. 65) -> Open Short
  sizeUsd?: number;
  /** Learned caution (0 upward) — see MomentumConfig's doc comment. */
  caution?: number;
}

export class MeanReversionStrategy implements Strategy {
  id = "mean-reversion-v1";

  private prices: number[] = [];
  private position: "long" | "short" | "flat" = "flat";

  private readonly windowSize: number;
  private readonly rsiLowerThreshold: number;
  private readonly rsiUpperThreshold: number;
  private readonly sizeUsd: number;

  constructor(config: MeanReversionConfig = {}) {
    const caution = config.caution ?? 0;
    this.windowSize = config.windowSize ?? 14;
    this.rsiLowerThreshold = Math.max((config.rsiLowerThreshold ?? 35) - caution * 10, 5);
    this.rsiUpperThreshold = Math.min((config.rsiUpperThreshold ?? 65) + caution * 10, 95);
    this.sizeUsd = config.sizeUsd ?? 25;
  }

  async init(): Promise<void> {
    this.prices = [];
    this.position = "flat";
  }

  private calculateRSI(): number {
    if (this.prices.length < this.windowSize + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i < this.prices.length; i++) {
      const change = this.prices[i] - this.prices[i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / (this.prices.length - 1);
    const avgLoss = losses / (this.prices.length - 1);

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  async onTick(snapshot: MarketSnapshot): Promise<TradeDecision> {
    this.prices.push(snapshot.price);
    if (this.prices.length > this.windowSize + 5) this.prices.shift();
    if (this.prices.length < this.windowSize) return { action: "none" };

    const rsi = this.calculateRSI();

    if (this.position === "flat") {
      if (rsi <= this.rsiLowerThreshold) {
        return {
          action: "open",
          side: "long",
          sizeUsd: this.sizeUsd,
          reason: `RSI Reversion: RSI ${rsi.toFixed(1)} <= oversold threshold ${this.rsiLowerThreshold.toFixed(1)}`
        };
      }
      if (rsi >= this.rsiUpperThreshold) {
        return {
          action: "open",
          side: "short",
          sizeUsd: this.sizeUsd,
          reason: `RSI Reversion: RSI ${rsi.toFixed(1)} >= overbought threshold ${this.rsiUpperThreshold.toFixed(1)}`
        };
      }
      return { action: "none" };
    }

    // Exit position when RSI normalizes back to center (48 - 52)
    const shouldClose =
      (this.position === "long" && rsi >= 50) ||
      (this.position === "short" && rsi <= 50);

    if (shouldClose) {
      return {
        action: "close",
        reason: `RSI Reverted: RSI normalized to ${rsi.toFixed(1)} (crossed 50)`
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
