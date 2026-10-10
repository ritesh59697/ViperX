import { MarketSnapshot, Strategy, TradeDecision } from "../strategy";

/**
 * A follower agent's strategy: it never proposes its own action from price
 * data (onTick always returns "none") — runner.ts drives it externally,
 * replaying a source agent's confirmed decision through the same
 * executeDecision path a self-directed strategy uses. position/confirmAction
 * exist only so this strategy's own belief state stays consistent with what
 * actually executed, matching every other Strategy implementation.
 */
export class CopyStrategy implements Strategy {
  id = "copy-v1";

  private position: "long" | "short" | "flat" = "flat";

  constructor(
    public readonly sourceAgentPda: string,
    public readonly sizeUsd: number
  ) {}

  async init(): Promise<void> {
    this.position = "flat";
  }

  async onTick(_snapshot: MarketSnapshot): Promise<TradeDecision> {
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
