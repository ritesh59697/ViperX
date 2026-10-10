# pnl-indexer

Watches `viperx_agent_registry` events and computes PNL/ROI/risk metrics
into Postgres — the data source for the leaderboard.

## What's here

- `src/registryListener.ts` — backfills every existing `Agent` account, then
  subscribes to `agentRegistered` / `agentStatusChanged` / `agentBecameEligible`
  and keeps Postgres in sync live. Verified end-to-end against real devnet
  transactions, including a fresh `register_agent` picked up automatically
  with no restart.
- `src/metrics.ts` — realized/unrealized PNL, ROI, max drawdown, and a
  Sharpe-like ratio from a `trades` history (`calculateMetrics`), plus
  `updateAgentMetrics(agentPda)` which reads an agent's trades and writes a
  fresh `pnl_snapshots` row. Built and running (`index.ts` calls
  `syncAllMetrics()` on every startup) — verified against real trade data
  since 2026-07-23 (see below).
- `src/tradeIndexer.ts` — `processCompletedTrade` (insert a trade + refresh
  that agent's metrics) and `syncAllMetrics` (recompute every agent's
  snapshot on startup).
- `src/store.ts` — the Postgres write layer: `agents`, `trades`, and
  `pnl_snapshots` all have read/write helpers.
- `src/connection.ts` — RPC + read-only Anchor program setup, vendored IDL
  (same pattern as `backend/execution-runtime`).
- **What feeds real trade data in**: two independent paths, deliberately, not
  one. `backend/execution-runtime/src/drivers/velocityDriver.ts` self-reports
  — it calls `pool.query(INSERT INTO trades...)` directly (via its own
  `src/pnlWrite.ts`, duplicating this module's `metrics.ts` math since
  they're separate npm packages with no shared workspace) right after a real
  close. That's the fast path (see `backend/execution-runtime`'s
  `NEXT_STEPS.md` item 11 for why it exists) and it's untouched by the watcher
  below.
- `src/velocityWatcher.ts` (added 2026-07-31) — the independent, on-chain
  side: builds its own read-only `VelocityClient` (polling `BulkAccountLoader`,
  same pattern `velocityDriver.ts` uses) over every agent's vault pubkey from
  `store.ts`'s `getAgentsWithVault()`, and watches each one's SOL-PERP
  `PerpPosition.baseAssetAmount` for a nonzero → zero transition. On a close,
  it reads `PerpPosition.settledPnl` on-chain — "cumulative pnl settled in
  this market since the position was opened," per the SDK's own doc comment
  — to compute realized PNL without trusting anything `execution-runtime`
  reported. It does **not** replace the self-report: it reconciles against
  it, via three new `trades` columns (`onchain_verified_pnl`, `verified_at`,
  `pnl_divergence_flagged`) that `leaderboard-api`'s anti-gaming heuristics
  now read. **Verified live against a real devnet close** (2026-07-31, see
  `NEXT_STEPS.md` item 13 for the full run, including two real bugs it
  found along the way — one in `momentum.ts`, one in this watcher's own
  handling of a position that reverses direction without ever going flat).
  Like `runner.ts`, the watched agent set is fixed at startup — a newly
  delegated agent isn't picked up until
  this process restarts.

## Two gotchas that cost real debugging time — read before touching events

1. **Anchor event names are camelCase at runtime, not the PascalCase in the
   IDL.** `BorshEventCoder.decode()` normalizes `AgentStatusChanged` (as
   written in Rust and the IDL) to `agentStatusChanged` before
   `EventManager` matches it against listeners. Subscribe with
   `addEventListener("AgentStatusChanged", ...)` (the IDL casing) and it
   fails **completely silently** — no error, the listener "attaches"
   successfully, the callback just never fires, forever. Confirmed by
   decoding a real on-chain event and reading back its `.name`. Always use
   the camelCase form: `agentRegistered`, `agentStatusChanged`,
   `agentBecameEligible`, `agentAuthorityChanged`.
2. **A stale, pre-fix `Agent` account decodes without error and produces
   silently wrong data.** When `record_trade`'s authority fix added a field
   to the `Agent` struct (see CLAUDE.md), any account registered before that
   redeploy is still the old, smaller size. Anchor's Borsh decoder doesn't
   reject it — `owner`/`agent_id`/`name`/`strategy_uri` (fields before the
   insertion point) decode correctly, but `vault_pubkey` onward reads from
   the wrong offset, and nothing about the result looks obviously wrong
   (Pubkeys accept any 32 bytes; the shifted status-enum byte often still
   falls in a valid 0-2 range). `registryListener.ts`'s `AGENT_SPACE` check
   guards against this — verify the raw account byte length before trusting
   a decoded `Agent`, don't trust decode-without-throwing as proof of
   correctness.

## Local dev setup

```bash
createdb viperx
psql -d viperx -f schema.sql
npm install
```

```
RPC_URL=https://api.devnet.solana.com
REGISTRY_PROGRAM_ID=321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm
DATABASE_URL=postgresql://<user>@localhost:5432/viperx
```

`npm run dev` backfills, then runs the live registry listener and the
Velocity watcher until killed (Ctrl-C closes the event subscriptions, stops
the watcher's poll loop, and closes the pool cleanly). No extra env var
needed for the watcher — it reuses `RPC_URL`.

## Remaining build order

1. An independent on-chain Velocity watcher (`src/velocityWatcher.ts` or
   similar) — the one piece that would let this module detect and record
   trades itself, rather than trusting `execution-runtime`'s self-report.
   Not blocking anything today (real trade data already flows in via the
   self-report path), but worth revisiting if trust-minimization becomes a
   real concern before the leaderboard is public-facing for real users.
