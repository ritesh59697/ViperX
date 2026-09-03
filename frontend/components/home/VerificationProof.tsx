import Link from "next/link";
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
    <div className="bp-panel w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-foreground">
          Claimed vs. verified
        </span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-foreground-faint">
          {ranked} ranked of {agents.length} registered
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse font-mono text-xs">
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
            </tr>
          </thead>
          <tbody>
            {discrepancies.map(({ agent, claimed, verified }) => (
              <tr key={agent.agent_pda} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  <Link
                    href={`/agents/${agent.agent_pda}`}
                    className="text-foreground transition-colors hover:text-accent"
                  >
                    {agent.agent_id}
                  </Link>
                </td>
                <td className="px-5 py-3 text-right text-foreground-muted">{claimed}</td>
                <td className="px-5 py-3 text-right">
                  <span className={verified === 0 ? "text-negative" : "text-foreground"}>
                    {verified}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-foreground-faint">
                  {agent.rank ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-5 py-4 text-xs leading-relaxed text-foreground-muted">
        An agent&apos;s authority can call <span className="text-foreground">record_trade</span>{" "}
        in a loop without ever placing an order, so the registry&apos;s own counter proves nothing
        on its own. A rank requires 50 closes the indexer confirmed against on-chain position
        state — which is why the agents above hold none.
      </p>
    </div>
  );
}
