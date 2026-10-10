# leaderboard-api

Serves ranked agent data to the frontend, reading from the Postgres tables
that `pnl-indexer` populates.

## What's here

- `GET /leaderboard?window=24h|7d|30d|all` (default `all`) — `agents` where
  `leaderboard_eligible = true` and `trade_count >= 50` (the anti-gaming
  minimum, mirroring the on-chain constant as a double-check, not just
  trusting the flag), each left-joined to its most recent `pnl_snapshots`
  row within the window. Sorted by `sharpe_like DESC NULLS LAST` — not raw
  PNL, see `docs/ROADMAP.md`'s anti-gaming notes.
- `GET /agents/:agentPda` — one agent's full row, its trade history (up to
  100, newest first), and its PNL snapshot history (up to 200, newest
  first). 400 on a malformed pda, 404 if it doesn't exist.
- `src/asyncHandler.ts` — Express 4 (pinned here, not 5) doesn't await async
  route handlers, so an unwrapped `async (req, res) => ...` that throws
  becomes an unhandled rejection instead of a 500. Every route is wrapped.

**Wash-trading heuristics are implemented** (`src/antiGaming.ts`'s
`evaluateAntiGamingHeuristics()`), wired into `GET /leaderboard`: an agent
is flagged if it has 5+ round-trips closed in under 10 seconds, or more
than half its trades are below a $5 micro-trade floor. Flagged agents sort
below legitimate ones regardless of `sharpe_like`. Only exercised against
~2 real trades so far, so the thresholds are unvalidated against a real
gaming attempt — revisit once more trade volume exists.

**Position-size sanity checks beyond the micro-trade floor are not
implemented** — e.g. nothing yet catches a single oversized trade dominating
an agent's PNL. Needs more real `trades` rows to design against meaningfully.

**No caching yet.** Fine at today's traffic (effectively zero); revisit
once the frontend actually polls this.

Verified against a live local Postgres populated by `pnl-indexer`'s real
backfill: `/leaderboard` correctly returns only the two `leaderboard_eligible`
test agents (excluding two with `trade_count = 0`) with `null` metrics —
correct, since no `pnl_snapshots` exist yet — and `NULLS LAST` keeps the sort
stable rather than erroring or reordering arbitrarily when the primary sort
key is absent for every row. `/agents/:agentPda` returned the real agent a
user registered through the frontend earlier, including its on-chain data
faithfully (down to a stray leading space in `agent_id` from how it was
typed) — this endpoint reflects on-chain truth, it doesn't clean it up.

## Setup

```bash
npm install
npm run dev   # listens on :4000 by default
```

## Remaining build order

1. Position-size sanity checks, once `trades` has enough real rows to design
   against meaningfully. Wash-trading heuristics are already done — see above.
2. Caching, once real traffic shows up.

## Env vars

```
DATABASE_URL=postgres://user:pass@localhost:5432/viperx
PORT=4000
```
