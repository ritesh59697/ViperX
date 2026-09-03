/** Types shared by the Velocity hook and the components that render its state. */

/** Which on-chain action a transaction state refers to. */
export type VelocityAction = "init" | "deposit" | "delegate" | "open";

/**
 * Progress of the most recent Velocity transaction.
 * `signature` appears once submitted; `error` only on failure.
 */
export interface VelocityTransactionState {
  action: VelocityAction | null;
  status: "idle" | "signing" | "pending" | "confirmed" | "error";
  signature?: string;
  error?: string;
}

/**
 * A perp position flattened for display — amounts are preformatted decimal
 * strings, not BNs, so components don't need the SDK to render them.
 */
export interface VelocityPositionView {
  marketIndex: number;
  baseAssetAmount: string;
  quoteAssetAmount: string;
  direction: "long" | "short" | "flat";
}
