# ViperX — Demo Video Script

Target: **4–5 minutes**. Grant reviewers watch the first 30 seconds to
decide whether to watch the rest, so the differentiator goes early — not
after a tour of the UI.

The through-line: *anyone can claim a trading record; this system makes the
claim checkable.* Every scene should advance that, or be cut.

---

## Before recording — setup checklist

Do these in order. Several are easy to forget and visible on camera.

1. **Reset `caution` on any agent you'll show trading.** `skillEngine`
   ratchets it up after losing streaks; at 1.75 an agent's threshold is
   2.75× default and it will sit silent on devnet's flat oracle, looking
   broken rather than cautious.
   ```sql
   UPDATE agent_strategy_params
   SET params = params || '{"caution": 0}'::jsonb
   WHERE agent_pda = '<pda>';
   ```
2. **Start all three services** and confirm each responds:
   `leaderboard-api` (:4000), `pnl-indexer`, frontend (:3001).
3. **Confirm the leaderboard shows 2 ranked agents** — `curl -s
   localhost:4000/leaderboard | jq '.ranked_count'` should return `2`.
4. **Have a funded devnet wallet connected** in the browser if you plan to
   show the create-agent flow live.
5. **Pre-open the Solana explorer** on one real transaction signature, so
   the verification beat doesn't stall on a page load.
6. **Close the terminal tab with your RPC URL in it** — API keys end up in
   screen recordings.

---

## Scene 1 — The problem (0:00–0:30)

**Screen:** the landing page hero.

**Say:**
> Every AI trading agent claims to be profitable. The evidence is usually a
> screenshot. ViperX is a leaderboard where that claim has to survive being
> checked against the chain.

Keep this to two sentences. Do not tour the landing page.

---

## Scene 2 — The gap that matters (0:30–1:30)

This is the most important scene in the video. It is the thing no competitor
demo shows.

**Screen:** scroll to the "Claimed vs. verified" panel on the landing page.

**Say:**
> Here's the problem with putting trades on-chain and calling it proof. Our
> registry program has a `record_trade` instruction, called by the agent's
> own key. These three agents called it fifty times each. The registry says
> fifty trades.
>
> Our indexer independently checked the chain for the positions behind those
> trades and found zero. So they hold no rank. Not because we flagged them —
> because a rank requires fifty closes confirmed against on-chain position
> state, and they have none.

**Screen:** switch to a terminal, run:
```bash
curl -s "localhost:4000/leaderboard?all=true" | jq '.agents[] | {agent_id, trade_count, verified_trade_count, rank}'
```

**Say:**
> Claimed fifty. Verified zero. Rank null. That's the whole idea.

---

## Scene 3 — What a real record looks like (1:30–2:15)

**Screen:** the leaderboard page.

**Say:**
> Two agents cleared the gate. Fifty verified fills each, ranked on a
> risk-adjusted Sharpe rather than raw PnL — so a lucky high-leverage bet
> can't outrank real risk management.
>
> Two is a small number for a leaderboard. That's what fifty independently
> verified fills actually costs.

**Screen:** click into a ranked agent's profile. Show trade history and the
PnL chart.

**Say:**
> Every row here is a real devnet transaction.

**Screen:** click one transaction through to the Solana explorer.

Let it load fully and pause a beat. This is the "don't take our word for it"
moment and it should breathe.

---

## Scene 4 — Verification, and catching a liar (2:15–3:15)

**Screen:** the flagged-agents panel on the landing page, or:
```bash
curl -s localhost:4000/flagged-agents | jq
```

**Say:**
> The indexer doesn't just count fills — it reads each closed position's
> settled PnL directly from Velocity's on-chain state and compares it to
> what the runtime reported about itself.
>
> This agent reported profits of nine thousand nine hundred ninety-nine
> dollars. On-chain settled PnL was zero. The divergence got flagged and the
> agent is excluded from ranking.

**Say (important — don't skip):**
> We also flag sub-ten-second round trips and trades under five dollars.
> Those are heuristics — an attacker patient enough to hold for eleven
> seconds gets past the timing rule. They raise the cost of gaming. The
> verification gate is what actually makes the leaderboard mean something.

Stating a limitation on camera builds more credibility with a technical
reviewer than another feature would.

---

## Scene 5 — Non-custodial and the circuit breaker (3:15–4:00)

**Screen:** the create-agent flow's fund-and-delegate step.

**Say:**
> Deploying an agent takes two delegations: one lets our runtime trade your
> Velocity vault, one lets it update your agent's on-chain record. Neither
> grants withdrawal. We verified that directly — a delegate attempting a
> withdrawal is rejected by Velocity's own program.
>
> The runtime can also pause a misbehaving agent on-chain, and *only* pause
> it. Un-pausing requires the owner's signature. A compromised runtime key
> can silence your agent; it can never resurrect it, retire it, or move your
> funds.

If you have the terminal output from the circuit-breaker verification run,
showing `source: active / follower: paused` here is strong. Optional.

---

## Scene 6 — Close (4:00–4:30)

**Screen:** back to the leaderboard.

**Say:**
> Registry, execution runtime, independent verifier, ranked leaderboard —
> all live on Solana devnet, all verified with real transactions.
>
> This works on Solana specifically because an agent trading continuously
> with per-trade on-chain accounting is only economically coherent where
> transactions cost nothing and confirm instantly.
>
> The code is open. Every number in this demo is a live API call away.

---

## Things to avoid on camera

- **Don't show the pending-verification table without explaining it.** One
  row shows `roi 9999.00%` — the tampered self-report from the divergence
  test. Unexplained it looks like a bug; explained (Scene 4) it's the
  strongest moment in the demo. Never let a reviewer find it first.
- **Don't run a live trade** unless you've confirmed the oracle is moving.
  Devnet's SOL-PERP price is nearly flat, so a momentum strategy can sit
  silent indefinitely. Show recorded trades instead.
- **Don't claim "24/7 uptime" or round trade counts.** The real numbers
  (182 trades, 128 verified, 11 agents, 2 ranked) are on the site and a
  reviewer can check them.
- **Don't call the heuristics airtight.** See Scene 4.
