import { SKILL_DEFINITIONS } from "./skillDefinitions";
import {
  getAllAgentPdas,
  getLatestSnapshot,
  getRealTradeCount,
  getRecentRealTrades,
  getStrategyParams,
  insertTuningHistory,
  unlockSkill,
  upsertStrategyParams,
} from "./store";

const POLL_INTERVAL_MS = 15_000;
const QUICK_LOSS_HOLD_MS = 60_000;
const QUICK_LOSS_TRIGGER_COUNT = 3;
const CAUTION_STEP = 0.25;
const CAUTION_CAP = 2.0;

export interface SkillEngineHandle {
  stop: () => void;
}

/**
 * Unlocks skill badges and nudges each agent's `caution` strategy param based
 * on recent trade outcomes — the "learns from mistakes" mechanic. Mirrors
 * velocityWatcher.ts's shape: polls Postgres on a timer rather than being
 * pushed to, since the live trades/pnl_snapshots writer
 * (execution-runtime/src/pnlWrite.ts) has no in-process hook into this
 * package. Same accepted limitation as velocityWatcher/runner.ts: the agent
 * set is fixed at startup from whatever `agents` rows already exist —
 * restart to pick up newly registered agents.
 */
export async function startSkillEngine(): Promise<SkillEngineHandle> {
  const agentPdas = await getAllAgentPdas();
  if (agentPdas.length === 0) {
    console.log("[skillEngine] no agents in Postgres yet — nothing to track (restart after agents register).");
    return { stop: () => {} };
  }

  const lastCheckedTradeCount = new Map<string, number>();

  const checkSkills = async (agentPda: string, realTradeCount: number): Promise<void> => {
    const latestSnapshot = await getLatestSnapshot(agentPda);
    for (const skill of SKILL_DEFINITIONS) {
      if (!skill.check({ realTradeCount, latestSnapshot })) continue;
      const newlyUnlocked = await unlockSkill(agentPda, skill.key, realTradeCount);
      if (newlyUnlocked) {
        console.log(`[skillEngine] ${agentPda} unlocked skill "${skill.name}" (${realTradeCount} real trades)`);
      }
    }
  };

  const checkTuning = async (agentPda: string): Promise<void> => {
    const recentTrades = await getRecentRealTrades(agentPda, 5);
    const quickLosses = recentTrades.filter((t) => {
      if (t.realizedPnl == null || t.realizedPnl >= 0) return false;
      if (!t.openedAt || !t.closedAt) return false;
      return new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime() < QUICK_LOSS_HOLD_MS;
    }).length;

    if (quickLosses < QUICK_LOSS_TRIGGER_COUNT) return;

    const current = await getStrategyParams(agentPda);
    const newCaution = Math.min(current.caution + CAUTION_STEP, CAUTION_CAP);
    if (newCaution === current.caution) return; // already capped, nothing to do

    await upsertStrategyParams(agentPda, { caution: newCaution });
    await insertTuningHistory({
      agentPda,
      param: "caution",
      oldValue: current.caution,
      newValue: newCaution,
      reason: `${quickLosses} of the last ${recentTrades.length} trades closed as losses within 60s — raised caution to require stronger signals before trading.`,
    });
    console.log(
      `[skillEngine] ${agentPda} caution ${current.caution} -> ${newCaution} (${quickLosses} quick losses)`
    );
  };

  const pollOnce = async (): Promise<void> => {
    for (const agentPda of agentPdas) {
      try {
        const realTradeCount = await getRealTradeCount(agentPda);
        await checkSkills(agentPda, realTradeCount);

        const previousCount = lastCheckedTradeCount.get(agentPda) ?? 0;
        if (realTradeCount > previousCount) {
          lastCheckedTradeCount.set(agentPda, realTradeCount);
          await checkTuning(agentPda);
        }
      } catch (err) {
        console.error(`[skillEngine] poll failed for ${agentPda}:`, err);
      }
    }
  };

  await pollOnce();
  const interval = setInterval(pollOnce, POLL_INTERVAL_MS);

  return { stop: () => clearInterval(interval) };
}
