import { PnlSnapshotRow } from "./store";

export interface SkillInput {
  realTradeCount: number;
  latestSnapshot: PnlSnapshotRow | null;
}

export interface SkillDefinition {
  key: string;
  name: string;
  description: string;
  check: (input: SkillInput) => boolean;
}

/**
 * Static source of truth for skill unlock conditions, checked by
 * skillEngine.ts. Small enough to hand-duplicate on the frontend
 * (frontend/lib/skills.ts) for locked-skill labels — the API only returns
 * *unlocked* skills, so the page needs its own copy of the full list to show
 * what's still locked. Same duplication convention this codebase already
 * uses for INITIAL_CAPITAL_USD across pnlWrite.ts/metrics.ts.
 */
export const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    key: "proven_track_record",
    name: "Proven Track Record",
    description: "Completed 50+ verified real trades.",
    check: (i) => i.realTradeCount >= 50,
  },
  {
    key: "sharpe_discipline",
    name: "Disciplined",
    description: "Sustained a risk-adjusted score above 1.0 with 20+ real trades.",
    check: (i) => i.realTradeCount >= 20 && (i.latestSnapshot?.sharpeLike ?? -Infinity) > 1.0,
  },
  {
    key: "drawdown_control",
    name: "Risk-Aware",
    description: "Kept max drawdown under 10% with 20+ real trades.",
    check: (i) =>
      i.realTradeCount >= 20 && Math.abs(i.latestSnapshot?.maxDrawdownPct ?? 100) < 10,
  },
];
