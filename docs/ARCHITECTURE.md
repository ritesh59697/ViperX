# ViperX — Architecture

This describes the intended shape and why it's built this way. For what's
actually implemented and verified right now, read `CLAUDE.md` — it's kept
current; this file is the conceptual map, not a status tracker.

## System overview

The single most important property of this diagram is that **the party that
trades and the party that verifies are different**, and they read from
different sources. `execution-runtime` reports its own fills;
`pnl-indexer`'s watcher independently reads Velocity's on-chain
`PerpPosition.settledPnl` and reconciles against that self-report. A
leaderboard rank depends on the verified number, never the claimed one.

```
                            ┌──────────────────────────┐
                            │        Frontend           │
                            │  (Next.js + wallet)       │
                            └─────────────┬─────────────┘
                                          │ REST
                            ┌─────────────▼─────────────┐
                            │      Leaderboard API       │
                            │  ranks by risk-adjusted    │
                            │  Sharpe + anti-gaming      │
                            │  RANK GATE: 50 *verified*  │
                            │  fills, not claimed ones   │
                            └─────────────┬─────────────┘
                                          │ reads
                            ┌─────────────▼─────────────┐
                            │         Postgres           │
                            │  trades row holds BOTH:    │
                            │   realized_pnl  (claimed)  │
                            │   onchain_verified_pnl     │
                            └────▲──────────────────▲────┘
                    self-reports │                  │ writes verified
                                 │                  │ + divergence flag
            ┌────────────────────┴─────┐   ┌────────┴───────────────────┐
            │    Execution Runtime      │   │       PNL Indexer          │
            │  strategy loop per agent  │   │  velocityWatcher: read-only│
            │  opens/closes positions   │   │  poll of every agent vault │
            │  calls record_trade       │   │  skillEngine: auto-tuning  │
            └───┬───────────────────┬───┘   └────────▲──────────▲────────┘
                │ record_trade      │ trades         │          │
                │ authority_pause   │                │ reads    │ registry
                │                   │                │ settled  │ events
                │                   │                │ PnL      │
        ┌───────▼──────────┐   ┌────▼────────────────┴──┐       │
        │  Agent Registry   │   │      Velocity DEX      │       │
        │  (Anchor, devnet) │   │  devnet perp DEX,      │       │
        │  identity, status │   │  delegated vaults      │       │
        │  trade_count      │◀──┼────────────────────────┘       │
        │  (SELF-REPORTED)  │   └────────────────────────────────┘
        └───────────────────┘
                │
                └──── registry events ──────────────────────────▶
```

### The trust boundary

| Signal | Written by | Trusted for ranking? |
|---|---|---|
| `agent.trade_count` (on-chain) | the agent's own delegated authority | **No.** `record_trade` can be looped without trading. |
| `trades.realized_pnl` | `execution-runtime`, reporting its own fills | **No.** Same party that placed the trade. |
| `trades.onchain_verified_pnl` | `pnl-indexer`, reading `PerpPosition.settledPnl` | **Yes.** Independent party, on-chain source. |

Both numbers are retained deliberately. The watcher reconciles rather than
overwrites, because the *disagreement* between them is the anti-gaming
signal — an agent whose self-report contradicts chain state is precisely
what the leaderboard needs to demote.

## Modules (this repo)

| Path | Purpose | Stack |
|---|---|---|
| `programs/viperx_agent_registry` | On-chain agent identity: PDA per agent, status, trade count, leaderboard-eligibility flag | Anchor (Rust) |
| `backend/execution-runtime` | Runs each agent's strategy loop, submits perp trades to Velocity DEX via delegated vault, calls `record_trade` on the registry after each closed position | TypeScript, `@velocity-exchange/sdk` |
| `backend/pnl-indexer` | Listens to on-chain Velocity account changes + registry events, computes realized/unrealized PNL, ROI, drawdown, Sharpe-like ratio; writes to Postgres | TypeScript, Postgres |
| `backend/leaderboard-api` | Serves ranked agent data to the frontend; applies anti-gaming filters (min trade count, position size caps) | TypeScript, Express/Fastify, Postgres |
| `frontend` | Public leaderboard, agent profile pages, create-agent flow, arena/competition views | Next.js, `@solana/wallet-adapter` |
| `docs` | Roadmap, architecture, and (later) grant narrative drafts | Markdown |

## Data flow, end to end

1. User registers an agent → `register_agent` on the Anchor program → PDA created.
2. User funds a Velocity DEX delegated vault; vault pubkey is stored on the agent PDA.
3. `execution-runtime` picks up active agents, runs their strategy loop, submits trades to Velocity devnet through the vault.
4. `pnl-indexer` watches Velocity account state + registry events, computes PNL/ROI, writes rows to Postgres.
5. `execution-runtime` calls `record_trade` after each closed position — this is what flips `leaderboard_eligible` on-chain once an agent crosses the minimum track record.
6. `leaderboard-api` reads Postgres, ranks eligible agents, serves to the frontend.
7. `frontend` renders leaderboard, agent profiles, arena standings, and the subscribe/copy-trade flow (Phase 3).

## Why this shape

- **On-chain does only what needs trust guarantees**: identity, ownership, status, eligibility gating. Anything computation-heavy (PNL math, ranking, risk metrics) stays off-chain in the indexer — cheaper and easier to iterate on before you've locked the program's logic.
- **Velocity DEX does the actual trading**: no perp matching engine to build in Phase 1. Velocity's delegated vaults (`updateUserDelegate`) cover execution and non-custodial copy-trading structurally, for free — a delegate can trade an account but never withdraw from it. `execution-runtime` builds directly against `@velocity-exchange/sdk` (migrated 2026-07-23 from `@drift-labs/sdk` after Drift's shared devnet deployment developed a standing `deposit()` bug — see `CLAUDE.md` and `docs/VENUE-EVALUATION.md`), not `solana-agent-kit`: that toolkit's Drift plugin hardcodes Drift *mainnet* (now Velocity DEX, a different program after the April 2026 exploit — see `CLAUDE.md`), so it was never usable for this project's devnet target.
- **Modules are independently deployable**: execution-runtime, indexer, and leaderboard-api can each scale/restart independently, which matters once you have many agents running concurrently.
