import { AgentAccount, solanaToEvmAddress } from "../registryClient";
import { fetchTunedParams } from "../strategyParamsClient";
import { Strategy } from "../strategy";
import { CopyStrategy } from "./copyStrategy";
import { GridTradingStrategy } from "./grid";
import { MeanReversionStrategy } from "./meanReversion";
import { MomentumStrategy } from "./momentum";

export { GridTradingStrategy } from "./grid";
export { MeanReversionStrategy } from "./meanReversion";
export { MomentumStrategy } from "./momentum";
export { CopyStrategy } from "./copyStrategy";

/**
 * Strategy Factory — returns an appropriate strategy instance for a given agent.
 * If `copySubscription` is set, the agent is a copy-trading follower and gets a
 * CopyStrategy instead of a price-based one — checked before any name matching,
 * since a follower's own strategyUri/name is irrelevant once it's following.
 * Otherwise checks the agent's strategyUri/name or hashes its PDA to assign
 * diverse strategies. Resolves the agent's tuned params (skillEngine.ts's
 * auto-tuned `caution`, plus any numeric knobs the owner set via the arena's
 * "tune your agent" step) once here at construction time — not live-hot-reloaded,
 * same "fixed at startup" limitation runner.ts's agent list and velocityWatcher
 * already accept. Each strategy's constructor only reads the fields it knows
 * about (e.g. MomentumConfig ignores `gridSpacingBps`), so passing the same full
 * params object to whichever strategy gets picked is safe.
 */
export async function createStrategyForAgent(
  agent: AgentAccount,
  copySubscription?: { sourceAgentPda: string; sizeUsd: number }
): Promise<Strategy> {
  if (copySubscription) {
    return new CopyStrategy(copySubscription.sourceAgentPda, copySubscription.sizeUsd);
  }

  const uri = (agent.strategyUri ?? "").toLowerCase();
  const name = (agent.name ?? "").toLowerCase();
  const id = agent.agentId.toLowerCase();
  
  const isEvm = agent.publicKey.toBuffer().slice(0, 12).every((b) => b === 0);
  const pdaStr = isEvm ? solanaToEvmAddress(agent.publicKey) : agent.publicKey.toBase58();

  const params = await fetchTunedParams(pdaStr);
  if (params.caution > 0) {
    console.log(`[${agent.agentId}] resolved caution: ${params.caution}`);
  }

  if (uri.includes("mean") || uri.includes("rsi") || name.includes("reversion") || id.includes("reversion")) {
    return new MeanReversionStrategy(params);
  }

  if (uri.includes("grid") || name.includes("grid") || id.includes("grid")) {
    return new GridTradingStrategy(params);
  }

  if (uri.includes("momentum") || name.includes("momentum") || id.includes("momentum")) {
    return new MomentumStrategy(params);
  }

  // Deterministically hash the agent PDA string to distribute strategies evenly across agents
  let hash = 0;
  for (let i = 0; i < pdaStr.length; i++) {
    hash = (hash * 31 + pdaStr.charCodeAt(i)) & 0xffffffff;
  }
  const index = Math.abs(hash) % 3;

  switch (index) {
    case 0:
      return new MeanReversionStrategy(params);
    case 1:
      return new GridTradingStrategy(params);
    case 2:
    default:
      return new MomentumStrategy(params);
  }
}
