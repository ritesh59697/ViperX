# ViperX — Grant Narrative

Source material for grant applications (Solana Foundation, Colosseum,
Superteam) and the demo video. Every number and claim here is verifiable
against the live devnet deployment — see "Verify it yourself" at the end.

Status as of 2026-08-10. For implementation detail read `CLAUDE.md`; for
sequencing read `NEXT_STEPS.md`.

---

## The problem

Anyone can claim a trading record. Screenshots, Twitter threads, and
self-reported dashboards are the current state of proof in on-chain trading,
and none of them survive scrutiny: a screenshot is trivially faked, a
dashboard reports whatever its operator wants, and "trust me" is not an
audit trail.

This matters more for *AI* trading agents than for human traders, because
the pitch is inherently unverifiable. An autonomous agent's edge is a claim
about a process nobody can observe. If the only evidence is the operator's
own reporting, capital allocation becomes a popularity contest.

The naive fix — put the trades on-chain — is not sufficient on its own, and
that gap is the interesting part of this problem.

## Why "it's on-chain" isn't enough

An on-chain registry can record that an agent claims 50 trades. It cannot,
by itself, establish that those trades happened.

Concretely, in this system: the registry program exposes `record_trade`,
called by an agent's delegated authority to increment its trade counter. A
counter that an agent's own key increments is a self-report with extra
steps. Anyone can call it in a loop without ever placing an order.

**This is not hypothetical here.** Three registered agents on the live
devnet deployment show `trade_count: 50` — enough to satisfy the on-chain
eligibility flag — with **zero** corresponding fills. They hold no
leaderboard rank, and the landing page displays the discrepancy directly.

The distinction ViperX draws is between **claimed** and **verified**:

| | Source | Trustworthy? |
|---|---|---|
| `trade_count` on the agent PDA | the agent's own authority | No — self-reported |
| `trades` rows in Postgres | `execution-runtime` self-reporting its own fills | No — same party |
| `onchain_verified_pnl` | an independent watcher reading Velocity's `PerpPosition.settledPnl` | **Yes** — different party, on-chain source |

A leaderboard rank requires **50 closes independently confirmed against
on-chain position state**. Inflating the registry counter earns nothing.

## How verification actually works

`pnl-indexer`'s `velocityWatcher` runs a read-only client over every
registered agent's vault, polling each one's SOL-PERP position. When a
position closes, it reads `PerpPosition.settledPnl` directly from on-chain
state and computes realized PnL itself — never consulting what
`execution-runtime` reported.

It then **reconciles** rather than replaces. Both numbers are kept on the
same trade row: the self-report in `realized_pnl`, the independent
observation in `onchain_verified_pnl`. Where they disagree beyond a
threshold, the trade is flagged and the agent is sorted out of ranking.

That reconciliation is deliberate. Replacing the self-report would discard
the disagreement, and the disagreement is the signal — an agent whose own
reporting contradicts chain state is exactly what a leaderboard needs to
surface.

**This has been tested adversarially, not just designed.** A test agent was
made to report `realized_pnl: 9999` on trades whose on-chain settled PnL was
`0`. The watcher caught the divergence and the agent was flagged and
excluded. That agent still appears on the leaderboard's pending table
showing an absurd ROI — correctly ranked nowhere.

## Anti-gaming: what's enforced, and how strong each layer is

Stating this precisely matters more than overstating it.

**Layer 1 — the verification gate (strong).** A rank requires 50
independently confirmed fills. This is the load-bearing defense. It cannot
be satisfied by any amount of self-reporting, because the confirming party
reads chain state rather than the agent's claims.

**Layer 2 — heuristics (useful, evadable).** Three checks flag and demote
agents: a $5 minimum trade size, a sub-10-second round-trip detector, and
the PnL-divergence check above. All three have been fired by real attack
scripts against live devnet, not just unit-tested.

Their limits are known and worth stating plainly: the round-trip rule
triggers at 5+ sub-10-second trades, so an attacker who holds positions for
11 seconds evades it entirely. These are thresholds, not proofs. They raise
the cost of gaming; they don't eliminate it. Layer 1 is what makes the
leaderboard meaningful.

**Layer 3 — on-chain circuit breaker (structural).** The runtime key
delegated to trade an agent can pause that agent (`authority_pause`) but
can **never** un-pause it, retire it, edit its metadata, or move funds.
Reactivation requires the owner's signature. A compromised or malfunctioning
runtime can silence an agent; it can never resurrect or repurpose one.

Verified live: a follower agent forced into repeated trade failures tripped
its own breaker and was paused on-chain, while the source agent it mirrored
was untouched — confirming failures are isolated per agent.

## Non-custodial by construction

Users never hand over withdrawal rights. Two separate delegations, to two
different programs:

- **Velocity** `updateUserDelegate` — lets the runtime open and close
  positions in the user's vault
- **Registry** `set_authority` — lets the runtime call `record_trade` and
  `authority_pause`

Neither grants withdrawal. This was verified explicitly: a delegate-attempted
withdrawal is rejected by Velocity's own program. The non-custodial property
is enforced by the venue, not by ViperX's good intentions.

## Why Solana

Agent-driven trading is a high-transaction-count workload by nature. An
agent running a tick loop submits orders continuously, and every close writes
a `record_trade` call on top. This project alone has executed 180+ real
devnet trades during development, each carrying multiple transactions.

On a chain with meaningful gas costs, per-trade overhead would dominate the
strategy's economics — you would be forced to trade less often, which is
precisely the wrong constraint for a momentum or market-making agent.
Sub-second finality also means the verification loop observes closes in near
real time rather than minutes later.

This is not "Solana because it's fast." It's that continuous autonomous
trading with per-trade on-chain accounting is *only* economically coherent
where transactions are effectively free and confirmation is immediate.

## What exists today

Everything below runs against live Solana devnet and has been verified with
real transactions — not typechecked, not mocked.

- **Anchor registry program** deployed at
  `321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm`, 11/11 tests passing
- **Execution runtime** trading real SOL-PERP positions on Velocity devnet
  through delegated vaults, with three strategies (momentum, mean-reversion,
  grid)
- **Independent verification watcher** reconciling every close against
  on-chain `settledPnl`
- **Leaderboard API** ranking by a risk-adjusted Sharpe-like metric rather
  than raw PnL, with anti-gaming filters
- **Next.js frontend** — create-agent flow with real wallet signing, public
  leaderboard, agent profiles, arena seasons, copy-trade subscriptions
- **Arena mode** — time-boxed competitive seasons with signature-gated entry
- **Copy-trading** — signature-gated subscriptions where a follower mirrors
  a source agent's decisions at the follower's own size, with independent
  circuit breakers

Live figures: **182 real devnet trades, 128 independently verified, 11
registered agents, 2 ranked.**

Two ranked agents on a leaderboard is a small number, and deliberately so —
it's what 50 verified fills each actually costs. The three agents claiming 50
trades with zero verified fills are the reason the gate exists.

## What's deliberately not built

Stating scope honestly, since a reviewer will find these anyway:

- **No entry stake or prize pool** for arena seasons — free entry, no
  on-chain escrow. Deferred, not overlooked.
- **No management/performance fees** on copy-trading. The venue exposes the
  primitives (`managementFee`, `profitShare`); wiring them is Phase 3
  remaining work.
- **No notification layer** for subscribers.
- **Position-size caps relative to vault size** are unbuilt; only the
  micro-trade floor exists.
- **Per-trade PnL attribution within a burst** — when several closes land
  between two watcher polls, the on-chain delta is collective and can't be
  split per trade from account-state polling alone. The fix is event-log
  subscription (`SettlePnlRecord`); state polling is what's implemented.
- **Mainnet.** Devnet-first is intentional: the venue migration below is
  exactly why.

## Engineering judgment worth noting

Two decisions that a reviewer may find informative about how this project
handles risk.

**The venue migration.** The project originally targeted Drift. Drift's
shared devnet deployment developed a standing bug where `deposit()` failed
on every market — found by running a manual vault test before automating on
top of it, rather than discovering it inside a running trade loop.
Self-deploying a Drift fork was evaluated and rejected: unaudited code from
a protocol that had lost ~$285M in a mainnet exploit is a bad foundation for
a non-custodial product, independent of the toolchain problems. The project
migrated to Velocity (Drift's own post-exploit rebuild) only after verifying
its devnet deployment with real transactions — deposit, delegated open and
close, and a *rejected* delegate withdrawal.

**A dead venue that looked alive.** An alternative proposal suggested
pivoting to Zeta Markets. Zeta's own documentation states it ceased
operating in May 2025 — yet its devnet frontend still displayed live SOL
prices, because Pyth's oracles remain live behind a dead exchange. The SDK
still exported exactly the delegation API that had been advertised. Checking
the API surface would have confirmed the pivot; checking whether the venue
*ran* rejected it. That check now runs before adopting any dependency.

## Verify it yourself

Nothing here requires taking the project's word for it.

```bash
# Two ranked agents, ranked on risk-adjusted return
curl -s "$API/leaderboard" | jq '.ranked_count, .agents[:2]'

# The claimed-vs-verified gap: agents claiming 50 trades, 0 verified, no rank
curl -s "$API/leaderboard?all=true" | jq '.agents[] | {agent_id, trade_count, verified_trade_count, rank}'

# Agents the anti-gaming heuristics currently flag, with reasons
curl -s "$API/flagged-agents" | jq

# Recent real fills — each carries its devnet transaction signature
curl -s "$API/trades/recent" | jq '.trades[] | {agentId, sizeUsd, txSignature}'
```

Every `txSignature` resolves on Solana's devnet explorer. The registry
program is deployed and executable at the address above. The agents claiming
50 trades with zero verified fills are real rows, visible in the same API
response as the ranked ones.
