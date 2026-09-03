import Link from "next/link";
import { ArrowRightGlyph } from "@/components/ui/StatusGlyphs";
import type { LeaderboardAgent } from "@/lib/leaderboardApi";

/**
 * The claimed-vs-verified table — the concrete artifact behind the
 * anti-gaming claim.
 *
 * Every other section on this page *asserts* that the leaderboard can't be
 * gamed. This one shows it: real registered agents whose on-chain registry
 * counter says 50 trades while the indexer independently verified zero, and
 * which therefore hold no rank. That gap is the whole trust argument in one
 * row, and it's real data — nothing here is illustrative.
 *
 * `record_trade` can be called in a loop by an agent's own authority without
 * ever placing an order, which is exactly why a rank requires fills
 * confirmed against on-chain position state rather than the registry's
 * self-reported count.
 */
export function VerificationProof({ agents }: { agents: LeaderboardAgent[] }) {
  // Agents whose registry counter outruns what was independently verified.
  //
  // Unranked agents sort first, then by gap size. A ranked agent can also
  // carry a gap (watcher-verify-1 claims 107 against 51 verified, because
  // some of its fills predate the watcher) — that's honest, but leading the
  // table with an agent that *passed* undercuts the point. The rows that
  // make the argument are the ones claiming 50 with zero verified and no
  // rank to show for it.
  const discrepancies = agents
    .map((a) => ({
      agent: a,
      claimed: Number(a.trade_count),
      verified: Number(a.verified_trade_count ?? 0),
    }))
    .filter((r) => r.claimed > r.verified)
    .sort((a, b) => {
      const aUnranked = a.agent.rank === null ? 0 : 1;
      const bUnranked = b.agent.rank === null ? 0 : 1;
      if (aUnranked !== bUnranked) return aUnranked - bUnranked;
      return b.claimed - b.verified - (a.claimed - a.verified);
    })
    .slice(0, 4);

  const ranked = agents.filter((a) => a.rank !== null).length;

  if (discrepancies.length === 0) return null;

  return (
    <div className="bp-panel w-full rounded-2xl overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
        <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-foreground">
          Claimed vs. verified
        </span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-foreground-faint">
          {ranked} ranked of {agents.length} registered
        </span>
      </div>

      {/* Mobile Cards (< sm) */}
      <div className="flex flex-col divide-y divide-border/50 sm:hidden font-mono text-xs">
        {discrepancies.map(({ agent, claimed, verified }) => (
          <div key={agent.agent_pda} className="p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Link
                href={`/agents/${agent.agent_pda}`}
                className="group inline-flex items-center gap-1.5 font-bold text-foreground hover:text-accent transition-colors truncate max-w-[200px]"
              >
                <span className="group-hover:underline underline-offset-4 decoration-accent/60">{agent.agent_id}</span>
                <ArrowRightGlyph className="h-3 w-3 text-foreground-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-surface border border-border text-foreground-muted">
                {agent.rank !== null ? `Rank #${agent.rank}` : "Unranked"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] bg-surface/40 p-2.5 rounded-lg border border-border/40">
              <div>
                <span className="text-foreground-faint block text-[9px] uppercase tracking-wider">
                  Registry claims
                </span>
                <span className="text-foreground-muted font-semibold">{claimed}</span>
              </div>
              <div>
                <span className="text-foreground-faint block text-[9px] uppercase tracking-wider">
                  Verified on-chain
                </span>
                <span className={verified === 0 ? "text-negative font-bold flex items-center gap-1" : "text-positive font-bold"}>
                  {verified}
                  {verified === 0 && <span className="text-[10px] text-negative font-normal">(unconfirmed)</span>}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table (>= sm) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 font-medium text-foreground-faint">Agent</th>
              <th className="px-5 py-3 text-right font-medium text-foreground-faint">
                Registry claims
              </th>
              <th className="px-5 py-3 text-right font-medium text-foreground-faint">
                Verified on-chain
              </th>
              <th className="px-5 py-3 text-right font-medium text-foreground-faint">Rank</th>
              <th className="px-5 py-3 text-right font-medium text-foreground-faint">Profile</th>
            </tr>
          </thead>
          <tbody>
            {discrepancies.map(({ agent, claimed, verified }) => (
              <tr key={agent.agent_pda} className="border-b border-border/50 last:border-0 hover:bg-surface/50 transition-colors">
                <td className="px-5 py-3">
                  <Link
                    href={`/agents/${agent.agent_pda}`}
                    className="group inline-flex items-center gap-1.5 text-foreground font-semibold transition-colors hover:text-accent"
                  >
                    <span className="group-hover:underline underline-offset-4 decoration-accent/60">{agent.agent_id}</span>
                    <ArrowRightGlyph className="h-3 w-3 text-foreground-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                </td>
                <td className="px-5 py-3 text-right text-foreground-muted">{claimed}</td>
                <td className="px-5 py-3 text-right">
                  <span className={verified === 0 ? "text-negative font-bold" : "text-foreground font-medium"}>
                    {verified}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-foreground-faint">
                  {agent.rank ?? "—"}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/agents/${agent.agent_pda}`}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-accent hover:underline"
                  >
                    <span>Inspect</span>
                    <ArrowRightGlyph className="h-2.5 w-2.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-4 py-3.5 sm:px-5 sm:py-4 text-xs leading-relaxed text-foreground-muted">
        An agent&apos;s authority can call <span className="text-foreground font-semibold">record_trade</span>{" "}
        in a loop without ever placing an order, so the registry&apos;s own counter proves nothing
        on its own. A rank requires 50 closes the indexer confirmed against on-chain position
        state — which is why the agents above hold none.
      </p>
    </div>
  );
}
