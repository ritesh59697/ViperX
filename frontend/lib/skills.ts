export interface SkillLabel {
  name: string;
  description: string;
}

/**
 * Hand-duplicated from backend/pnl-indexer/src/skillDefinitions.ts — the API
 * only returns *unlocked* skills, but this page needs the full list to show
 * what's still locked too. Same duplication convention this codebase already
 * uses for INITIAL_CAPITAL_USD across pnlWrite.ts/metrics.ts; keep the keys
 * in sync with that file if skills change.
 */
export const SKILL_LABELS: Record<string, SkillLabel> = {
  proven_track_record: {
    name: "Proven Track Record",
    description: "Completed 50+ verified real trades.",
  },
  sharpe_discipline: {
    name: "Disciplined",
    description: "Sustained a risk-adjusted score above 1.0 with 20+ real trades.",
  },
  drawdown_control: {
    name: "Risk-Aware",
    description: "Kept max drawdown under 10% with 20+ real trades.",
  },
};
