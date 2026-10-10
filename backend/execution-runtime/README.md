# execution-runtime

Runs each active agent's strategy loop and submits trades to Velocity DEX
devnet through its delegated vault.

## What's here

- `src/connection.ts` — RPC + runtime keypair loading.
- `src/registryClient.ts` — reads `Active` agents delegated to this
  runtime's key, calls `record_trade` and `authority_pause` as `authority`.
  Verified against the live devnet registry.
- `src/strategies/momentum.ts` — the reference strategy (rolling-window
  momentum, open/close on threshold crossings).
- `src/driver.ts` — the `ExecutionDriver` interface every venue
  implementation follows (`init`, `getMarketSnapshot`, `switchActiveUser`,
  `openPosition`, `closePosition`), so `runner.ts` doesn't need to know
  which venue it's talking to.
- `src/drivers/velocityDriver.ts` — the real venue driver, built against
  `@velocity-exchange/sdk`. One shared `VelocityClient` trades many
  different owners' vaults via `authoritySubAccountMap` + `switchActiveUser`,
  keyed by whichever pubkey each owner delegated. Tracks each open
  position's entry price/side/size in memory and, on close, writes a real
  `trades` row + refreshed `pnl_snapshots` row via `src/pnlWrite.ts` —
  `execution-runtime` self-reporting its own trades, not an independent
  on-chain watcher (see `NEXT_STEPS.md` item 11 for that tradeoff).
- `src/pnlWrite.ts` — shared trade-insert + realized-PNL/ROI/Sharpe
  calculation, used by both `velocityDriver.ts` and `mockDriver.ts` so that
  math exists in exactly one place in this module (mirrors, but doesn't
  import, `pnl-indexer/src/metrics.ts` — separate npm package, no shared
  workspace). `recordTrade()` (on-chain) and this Postgres write are
  independent, deliberately: a 429 in one must not silently skip the other
  — see `CLAUDE.md`'s Gotchas for the real bug this was found fixing.
- `src/drivers/mockDriver.ts` — paper-trading driver for local testing
  without touching devnet.
- `src/runner.ts` — ties agents → strategy → driver → registry into a tick
  loop (`EXECUTION_VENUE` env var picks the driver). **Verified running its
  actual tick loop against a real delegated agent** (2026-07-23) — opened,
  closed, and recorded (both on-chain and in Postgres) a real trade on
  Velocity devnet. See `NEXT_STEPS.md` for the full account, including a
  crash-resilience fix (`unhandledRejection`/`uncaughtException` handlers)
  found necessary under real RPC load.
- `scripts/velocity-devnet-vault-test.ts` — the manual, one-shot delegation
  proof (`NEXT_STEPS.md` step 2), verified against real devnet 2026-07-23:
  real on-chain deposit, delegated open, delegated close, and a rejected
  delegate withdrawal. Supersedes `scripts/drift-devnet-vault-test.ts`.

Builds directly against `@velocity-exchange/sdk` (migrated 2026-07-23 from
`@drift-labs/sdk` — see `docs/VENUE-EVALUATION.md`'s migration addendum),
not `solana-agent-kit`: that toolkit's Drift plugin hardcodes Drift
*mainnet* (now Velocity DEX, a different program after the April 2026
exploit), so it was never usable for this project's devnet target. Don't
re-add it — see `CLAUDE.md`.

## Formerly blocked on Drift devnet — resolved by migrating to Velocity

`DriftClient.deposit()` was broken for every market on Drift's old shared
devnet deployment — confirmed with two independently-valid deposits (native
SOL and real devnet USDC), both failing identically on-chain. That was never
fixed upstream; instead, the project migrated to Velocity DEX's own,
separate devnet deployment (Drift's post-exploit rebuild), where the
equivalent deposit was verified working with a real on-chain transaction.
Full evidence in `docs/VENUE-EVALUATION.md`'s addenda. `runner.ts`'s tick
loop can now meaningfully run against real collateral — it just hasn't been
run yet (see `NEXT_STEPS.md`).

## Circuit breaker: real on-chain pause, not just a local kill switch

On `MAX_CONSECUTIVE_FAILURES` consecutive trade failures, `runner.ts` stops
trading that agent in-process *and* calls the registry's `authority_pause`
instruction, which flips on-chain `status` from `Active` to `Paused`. That
instruction is deliberately narrower than `set_status`: the delegated
`authority` key can only move `Active` -> `Paused`, one-directionally — it
still cannot reactivate, retire, or touch anything else about the agent.
Reactivating always requires the owner's own `set_status` call. If the pause
transaction itself fails, the runner logs that separately and falls back to
the old behavior (local-only, on-chain status stays `Active` until the owner
notices) — see `src/runner.ts`'s `handleAgent`.

## Setup

```bash
npm install
npm run build    # tsc -p .  → dist/
npm run dev      # ts-node src/runner.ts — starts the real tick loop, not a one-shot script
```

`.env` needs `RPC_URL`, `REGISTRY_PROGRAM_ID`, `RUNTIME_KEYPAIR_PATH` — none are defaulted, all
throw loudly if missing (see `src/connection.ts`). `LEADERBOARD_API_URL` is optional (defaults to
`http://localhost:4000`) — used only to fetch an agent's learned `caution` value at strategy
construction time; if leaderboard-api is unreachable, strategies just fall back to their
unlearned defaults rather than failing to start (see `src/strategyParamsClient.ts`).

`idl/viperx_agent_registry.json` is a vendored copy of the root `idl/`, kept so this module stays
independently deployable — re-copy it from there after any program change, don't hand-edit it.
`registryClient.ts` throws loudly at startup if `REGISTRY_PROGRAM_ID` disagrees with this file's
`address`.

## Env vars (create `.env`, do not commit)

```
RPC_URL=<your dedicated devnet RPC — Helius or QuickNode, not a public endpoint>
REGISTRY_PROGRAM_ID=<from anchor keys list>
RUNTIME_KEYPAIR_PATH=<path to this runtime's own keypair>
LEADERBOARD_API_URL=http://localhost:4000   # optional, for learned caution values
```
