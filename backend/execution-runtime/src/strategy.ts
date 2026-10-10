/**
 * Generic strategy interface — every agent strategy implements this.
 * Keeping it minimal on purpose: the execution runtime shouldn't care
 * whether a strategy is a hand-written rule set or an LLM-driven agent,
 * as long as it can answer "what should I do on this tick".
 */

export type TradeDecision =
  | { action: "none"; reason?: string }
  | { action: "open"; side: "long" | "short"; sizeUsd: number; reason?: string }
  | { action: "close"; reason?: string };

export interface MarketSnapshot {
  marketSymbol: string; // e.g. "SOL-PERP"
  price: number;
  timestamp: number;
  // extend with orderbook depth, funding rate, etc. as needed
}

export interface Strategy {
  id: string;
  init(): Promise<void>;
  /**
   * Proposes a decision based on current position belief — must not mutate
   * that belief itself. A failed driver call (bad collateral, a dropped RPC,
   * anything) must leave the strategy's position exactly as it was; only
   * `confirmAction` moves it, and only once the trade is confirmed for real.
   */
  onTick(snapshot: MarketSnapshot): Promise<TradeDecision>;
  /**
   * Called by the runner only after `decision`'s driver call actually
   * succeeded on-chain — applies the resulting position-state transition.
   * Never called on failure: found live (2026-07-31) that mutating position
   * belief inside onTick, before the trade was confirmed, let a single
   * failed open/close desync the strategy from reality permanently — see
   * CLAUDE.md's Gotchas.
   */
  confirmAction(decision: TradeDecision): void;
}

// TODO: implement a first reference strategy in ./momentum.ts
// that decides long/short based on short-window price momentum,
// respecting a max position size passed in via agent config.
