# Next Steps

Concrete, ordered build tasks from where this repo currently stands.
Each module's own README has the detailed build order — this file is the
top-level sequencing across all of them. For full detail on what's actually
built and verified, read `CLAUDE.md` — kept current, this file just tracks
sequencing.

## Done

1. **Agent registry deployed and fixed.** Live on devnet at
   `321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm`. The `record_trade`
   authority fix (backend can bump `trade_count` via a delegated
   `authority` key, without holding owner keys) is deployed and verified —
   see `CLAUDE.md`'s Gotchas for the full story and the two account-layout
   traps that came with it.
2. **Manual Drift devnet vault test — run, and it found a real blocker.**
   Delegation itself (`updateUserDelegate`, multi-owner trading via
   `authoritySubAccountMap`) is implemented correctly per the SDK's types.
   But `DriftClient.deposit()` is currently broken for every market on this
   devnet deployment — not our code, not fixable from here. Full evidence
   in `docs/VENUE-EVALUATION.md`'s addendum. This is the one thing blocking
   everything downstream that needs real trades.
3. **execution-runtime's core is built**: connection, registry client
   (verified live), the reference momentum strategy, and the runner tying
   them together with `authoritySubAccountMap` + `switchActiveUser` for
   multi-owner trading. Type-checked and structurally correct, but **never
   run in its actual tick loop** — that needs step 2's blocker cleared
   first, since there's no way to open a real position without collateral.
4. **pnl-indexer's registry side is built and verified live**: backfills
   every `Agent` account, then stays in sync via on-chain events with no
   restart needed. Proved by registering a real agent through the frontend
   and watching it appear automatically.
5. **leaderboard-api is built and verified**: `GET /leaderboard` (window
   filtering, ranked by `sharpe_like DESC NULLS LAST`) and
   `GET /agents/:agentPda`, both tested against real backfilled data.
6. **Frontend create-agent and leaderboard pages are built and verified**:
   a real user registered a real agent with a real Phantom wallet, and it
   showed up on the leaderboard page end to end. Leaderboard page also
   verified to fail gracefully if `leaderboard-api` is down.
7. **Frontend agent-profile page is built and verified**
   (`app/agents/[agentPda]/page.tsx`): reads `leaderboard-api`'s
   `GET /agents/:agentPda`, linked from every leaderboard row. Verified
   against real backfilled agent rows, 404s correctly for an unknown PDA,
   and fails gracefully (no crash) with `leaderboard-api` down.
8. **Circuit-breaker trust-boundary gap closed.** Added `authority_pause` to
   the registry program — the delegated `authority` key can now move an
   agent `Active` -> `Paused` on-chain, one-directionally (it still can't
   reactivate, retire, or touch anything else; only the owner's `set_status`
   can). Redeployed to the same program ID, IDL re-synced to all three
   vendored copies, `runner.ts`'s circuit breaker now calls it instead of
   only disabling locally. Verified live: 11/11 Anchor tests pass against
   real devnet. See `CLAUDE.md`'s Gotchas for the full design rationale.
9. **`useVelocity.ts` wired into the create-agent flow, and verified end to
   end with a real wallet.** `components/create/FundAndDelegate.tsx` renders
   after `register_agent` confirms: initialize a Velocity account, deposit
   SOL collateral, delegate trading rights to the runtime (Velocity's own
   `updateUserDelegate`), and separately authorize that runtime key on the
   registry (`set_authority`) — two different programs, two different
   delegations. Each step's "done" state reads real on-chain fields rather
   than the hook's transient last-action status. **Verified 2026-07-23 with a
   real connected wallet against live devnet**: fresh `register_agent` →
   all four fund/delegate steps, signed and confirmed. Real-wallet testing
   found two real bugs typechecking couldn't catch — see `CLAUDE.md`'s
   Gotchas for both:
   - `@velocity-exchange/sdk`'s browser build unconditionally `require("fs")`
     in a Node-only helper nothing here calls, which broke `next build`
     outright — fixed with a browser-scoped `turbopack.resolveAlias` in
     `next.config.ts` (see `frontend/README.md`).
   - `VelocityClient` turned out to be completely blocked in that same
     browser build (`"AnchorProvider is not supported in the browser
     build"` — a deliberate SDK restriction, not a bundling issue), and its
     suggested replacement (`VelocityCore`) doesn't yet wrap two of the four
     needed instructions. Fixed by rewriting `useVelocity.ts` to build its
     own real `Program<Velocity>` via `@coral-xyz/anchor` (same package
     `lib/registry.ts` already uses) and calling instructions directly.
   - A third bug, in the create-agent page itself rather than the Velocity
     migration: the "already registered" pre-flight check left stale
     `confirmed` state on screen after the Agent ID field changed, hiding
     the Register button with no way back except a page reload. Fixed by
     resetting state whenever the Agent ID changes.
10. **`execution-runtime`'s tick loop run for real, against a real
    delegated agent — a real trade confirmed on-chain.** `momentum-sol-1`
    (registered, funded, and delegated end to end via the frontend flow
    above) opened a real long position, closed it, and called
    `record_trade`, all through `VelocityExecutionDriver` against live
    Velocity devnet. Independently re-fetched the `Agent` account
    afterward: `trade_count` 0 → 1, `status` still `Active`,
    `leaderboard_eligible` correctly still `false` (needs 50, not 1).
    Devnet's SOL-PERP oracle barely moves (~2-3bps sampled directly), so
    `momentum.ts`'s thresholds were temporarily lowered to prove the
    pipeline fires, then reverted to the real defaults (20-tick window,
    50bps) immediately after confirming. Along the way, an unhandled RPC
    429 from `VelocityClient`'s background account polling (public devnet
    RPC, under sustained load) crashed the whole standing process outright
    — not just one tick. Fixed with top-level `unhandledRejection`/
    `uncaughtException` handlers in `runner.ts` so a transient RPC hiccup
    logs and keeps the loop alive; the real fix for sustained operation is
    still a dedicated RPC. See `CLAUDE.md`'s Gotchas for both findings.
11. **Real Velocity trades now write PNL data to Postgres — `execution-runtime` self-reports, verified live.**
    Chose the faster of two designs (execution-runtime self-reports vs.
    pnl-indexer independently watching on-chain Velocity state) —
    `velocityDriver.ts` now tracks each open position's side/size/entry
    price in memory and, on close, calls a new `src/pnlWrite.ts` helper
    (shared with `mockDriver.ts`'s existing inline logic, extracted rather
    than duplicated a third time) that inserts a `trades` row and
    recomputes that agent's `pnl_snapshots` row using the same
    realized-PNL/ROI/Sharpe math `pnl-indexer/src/metrics.ts` uses
    (duplicated by necessity — separate npm packages, no shared workspace —
    kept in sync by convention, not by import). Note this means the
    leaderboard currently trusts the runtime's own report of its trades,
    not an independent on-chain read — a real tradeoff, chosen deliberately
    for speed over trust-minimization; revisit if/when gaming becomes a
    real concern.

    **Found and fixed a second real bug live**: the first attempt tied the
    Postgres write to `registry.recordTrade()` succeeding first — under
    RPC load, `recordTrade()` threw a 429, which skipped the whole Postgres
    write too, silently losing a real closed trade's history entirely
    (confirmed: `trade_count` stayed unchanged and zero `trades` rows
    existed for that close). Fixed by decoupling the two into independent
    try/catches, since a closed position is closed on-chain regardless of
    whether either bookkeeping step succeeds — and neither should trip
    `runner.ts`'s circuit breaker anymore, since that's meant for repeated
    *trading* failures, not incidental RPC hiccups in bookkeeping after a
    healthy close. Re-verified live after the fix: a subsequent real close
    (`momentum-sol-1`, short, tx `2qyNxexcBEf9...`) both called
    `record_trade` successfully (`trade_count` 1 → 2) *and* wrote a correct
    `trades` row + `pnl_snapshots` row to Postgres, under the same RPC
    pressure that broke the first attempt.
12. **leaderboard-api's anti-gaming heuristics are implemented and wired in**,
    not just planned in the README. `src/antiGaming.ts`'s
    `evaluateAntiGamingHeuristics()` flags an agent as wash-traded on either
    signal — 5+ round-trips closed in under 10 seconds, or more than half its
    trades below a $5 micro-trade floor — and `GET /leaderboard` calls it per
    agent, sorting flagged agents below legitimate ones regardless of Sharpe.
    Confirmed wired (not dead code) by reading `routes/leaderboard.ts`
    directly. Still only exercised against ~2 real trades so far, so the
    thresholds are unvalidated against real gaming attempts — see "What's
    left" below.
13. **pnl-indexer's independent Velocity watcher is implemented** —
    `src/velocityWatcher.ts`, the piece item 11 explicitly deferred. It
    builds its own read-only `VelocityClient` (polling `BulkAccountLoader`,
    same pattern as `velocityDriver.ts`) over every agent's vault pubkey,
    and watches each one's SOL-PERP `PerpPosition.baseAssetAmount` for a
    nonzero → zero transition. On a close, it reads `PerpPosition.settledPnl`
    (on-chain, "cumulative pnl settled in this market since the position was
    opened" per the SDK's own doc comment) and computes realized PNL
    independent of anything `execution-runtime` self-reports. This does
    **not** replace the self-report path (a deliberate choice — see the
    question this resolved): it reconciles against it. Three new `trades`
    columns (`onchain_verified_pnl`, `verified_at`, `pnl_divergence_flagged`)
    let the watcher record its independently-observed number against the
    same row `pnlWrite.ts` already wrote, and `leaderboard-api`'s
    `antiGaming.ts` now flags (and sorts down) any agent with 2+
    divergence-flagged trades, alongside the existing wash-trade heuristics.
    Both `pnl-indexer` and `leaderboard-api` build and typecheck clean.
    Matches `runner.ts`'s existing limitation of a fixed-at-startup agent set
    (a newly delegated agent isn't watched until the indexer restarts).

    **Verified live against a real devnet close, 2026-07-31.** First attempt
    used the two real registered agents (`momentum-sol-1`/`momentum-sol-3`),
    but both share one underlying vault with too little Velocity collateral
    for a $10 position (`InsufficientCollateral`) — and hit a real bug in
    `momentum.ts` along the way (see CLAUDE.md's Gotchas: it flips its
    position belief before confirming the trade landed, so a failed open
    left it trying to close a nonexistent position next tick, oscillating
    between two failure modes without ever tripping the circuit breaker).
    The runner was stopped one failure short of `authority_pause` firing on
    those two real agents for real — confirmed neither was actually paused.

    Registered a fresh throwaway test agent instead (`watcher-verify-1`,
    PDA `CLqQSNFHXeoPd3siR2fZxTB31QAyCNid5ymXBpoTutn4`), reusing a devnet
    keypair (`velocity-owner-keypair.json`) already pre-funded with ~1000
    dUSDT and already Velocity-delegated to the runtime key from an earlier
    manual vault-test run — only the registry side (`register_agent` +
    `set_authority`) needed doing. Its own run hit the *same* `momentum.ts`
    bug (a failed reduce-only close, followed by an opposing open that
    netted straight from long to short without ever resting at exactly
    zero) — which surfaced a **second real bug**, this time in
    `velocityWatcher.ts` itself: it only detects a clean flat → open → flat
    cycle, so a direct reversal that skips zero between 5s polls is missed
    entirely (see CLAUDE.md's Gotchas for the mechanism). Stopped the
    runner again and closed the position deliberately via a one-off script
    that called the exact same production functions the automated flow
    would have (`VelocityClient.closePosition`, `RegistryClient.recordTrade`,
    `pnlWrite.ts`'s `recordClosedTrade`) — a real on-chain close
    (tx `pW9AMqM5...`), not a synthetic one.

    The watcher, still running, caught it within one 5-second poll:
    `[velocityWatcher][CLqQSNFH...] verified trade #322: self-reported $0.01
    vs on-chain $0.00`. Confirmed correct via both a direct Postgres query
    (`onchain_verified_pnl: 0`, `verified_at` populated, `pnl_divergence_flagged:
    false` — correctly not flagged, well under the $0.50 threshold) and a
    real `GET /agents/:agentPda` call returning the same data through
    `leaderboard-api`. This is the same bar every other "verified live" claim
    in this file meets — a real transaction, independently re-queried, not
    just a clean build.
14. **Fixed the strategy optimistic-state bug item 13 found.** All three
    reference strategies (`momentum.ts`, `grid.ts`, `meanReversion.ts`) used
    to mutate their internal `position` belief inside `onTick()`, before
    `runner.ts` ever called the driver — so a failed open/close (like the
    `InsufficientCollateral` above) left the strategy permanently out of
    sync with the real on-chain position, oscillating between trying to
    open and trying to close a position that didn't exist, without ever
    tripping the circuit breaker (an intervening `action: "none"` tick
    unconditionally reset `consecutiveFailures` to 0). Fixed by splitting
    the `Strategy` interface (`src/strategy.ts`): `onTick()` now only
    proposes a decision, and a new `confirmAction(decision)` — called by
    `runner.ts`'s `handleAgent()` only immediately after the matching driver
    call actually succeeds — applies the position transition. `grid.ts`
    additionally deferred its `lastTradePrice` mutation the same way via a
    new `pendingTradePrice` field. Typechecks and builds clean. **Not yet
    re-verified live** — the vault that originally exposed this
    (`momentum-sol-1`/`momentum-sol-3`'s shared, under-collateralized
    vault) is still unfunded, so there's no current way to force a real
    repeated failure and confirm the circuit breaker now trips correctly
    instead of oscillating. `velocityWatcher.ts`'s separate reversal-blind-spot
    bug (below) is unaffected by this fix — it's a different bug, in a
    different module.
15. **Fixed `velocityWatcher.ts`'s reversal-blind-spot from item 13.**
    `pollOnce()`'s two-state check (`wasOpen`/`isOpen`) only ever handled a
    clean flat → open → flat cycle. Added a third branch: when both polls
    see a nonzero position but the sign of `baseAssetAmount` flipped
    (`prev.baseAssetAmount.isNeg() !== position.baseAssetAmount.isNeg()`),
    treat it as a close-then-open in one step — reconcile the old leg using
    the `settledPnl` delta up to that poll (same math as a normal close),
    then start a fresh `settledPnlAtOpen` baseline from the new leg's first
    observed poll, instead of silently carrying the old leg's baseline
    forward into whatever close is caught next. Typechecks and builds
    clean (`npm run build` in `backend/pnl-indexer`).

    **Live-verified 2026-08-01**, since item 14's fix means none of the
    three reference strategies can produce a same-poll reversal
    organically anymore (they always close before opening the opposite
    direction) — needed a deliberate forced reversal instead, the same way
    `watcher-verify-1`'s close in item 13 was forced manually. New script
    `backend/execution-runtime/scripts/force-reversal.ts` opened a real $2
    long, then — without ever closing it — opened a real $5 short, which
    Velocity netted directly against the long in one on-chain settlement
    (`baseAssetAmount`: `+27,400,000` → `-41,100,000`, no observable zero
    in between). Watched it live with a temporary poll-level debug log
    added to `velocityWatcher.ts` (gated behind `VELOCITY_WATCHER_DEBUG=1`,
    kept in the code afterward as a harmless opt-in diagnostic — proved
    useful enough today to leave in). Confirmed the full intended sequence:
    - Long observed, baseline set silently (no log — correct, nothing to
      reconcile yet).
    - Reversal poll: `wasOpen=true isOpen=true`, sign flipped — the new
      branch fired and logged `observed an on-chain close but no matching
      unverified trades row exists yet`, the *correct* honest outcome
      since the reversal itself never goes through `closePosition()`/
      `recordClosedTrade()` and so has no self-report row to match.
      Baseline reset to the new short leg immediately after.
    - Real close (via `driver.closePosition()`, which does write a real
      `trades` row): reconciled cleanly against *only* the new leg —
      `verified trade #329: self-reported $0.00 vs on-chain $0.00` — not
      conflated with the original long leg the way the pre-fix code would
      have.

    One process-hygiene note from this run: `pkill -f "ts-node src/index.ts"`
    matches *any* module's dev server by that shared relative path — it
    killed `leaderboard-api` along with the intended `pnl-indexer` restart.
    Both were restarted fine, but worth remembering next time multiple
    `npm run dev` processes are up together.
16. **Live-verified leaderboard-api's micro-trade anti-gaming heuristic
    against a real devnet trade sequence** (2026-08-01) — previously only
    exercised against ~2 real trades, never enough to actually cross a
    threshold. New one-off script `backend/execution-runtime/scripts/
    generate-micro-trades.ts` reuses the exact production
    `VelocityExecutionDriver`/`RegistryClient` code path `runner.ts` uses
    (same as item 13's forced close) to run real $2 open/close cycles
    against `watcher-verify-1`, well below `antiGaming.ts`'s $5
    `MIN_TRADE_SIZE_USD` floor. 3 of 4 attempted cycles landed as real
    trades (the 4th hit a plain devnet-RPC 429 before opening anything, no
    cleanup needed); combined with the 2 micro-trades from item 13's own
    verification and the original $10 trade, that's 5 micro + 1 real out
    of 6 total — crossing both the `trades.length > 5` and
    `microTradeCount / trades.length > 0.5` thresholds. A real
    `GET /agents/:agentPda` call confirmed the flag fired:
    `isWashTraded: true`, `microTradeCount: 5`, `validTradeCount: 1`,
    `flaggedReason: "Majority micro-trades below $5 minimum threshold"` —
    not just a clean typecheck. The rapid-round-trip (<10s) and PNL-
    divergence thresholds are still unexercised by a real trade sequence.

    Found two things worth recording along the way, both about the *test
    script*, not production code:
    - A single long-running `VelocityClient`/`BulkAccountLoader` reused
      across several open/close cycles eventually made `closePosition()`
      read the position as flat (`OrderAmountTooSmall`) even right after
      `forceGetUserAccount()`, while a completely fresh, isolated client
      read the same on-chain state correctly every time. Root cause not
      fully isolated (suspected poll/force-fetch interleaving over a
      longer-lived subscription) — worked around by spinning up a fresh
      driver per cycle instead of one shared instance, matching what item
      13's one-off forced-close script already did successfully.
    - Even with a fresh driver per cycle, the same `OrderAmountTooSmall`
      symptom still showed up intermittently and needed real patience (up
      to ~90s of retries) before succeeding — this really was devnet RPC
      lag, not a client-state bug, confirmed when cycle 4 failed outright
      with an explicit `429 Too Many Requests` from `api.devnet.solana.com`
      while trying to fetch oracle data for a brand-new subscription. Same
      root cause as the existing "use a dedicated devnet RPC" item below,
      just now also reproduced during a scripted trade sequence, not only
      the standing tick loop.
    - `backend/execution-runtime/scripts/close-leftover-position.ts` (new)
      is a small cleanup helper for the dangling positions these retries
      left behind mid-debugging — closes whatever's currently open on
      `watcher-verify-1` and records it, same as any other real close.

17. **Agent skills + auto-tuning ("agent learns from mistakes") built and
    live-verified** (2026-08-02). `pnl-indexer/src/skillEngine.ts` is a
    `velocityWatcher`-shaped 15s poll loop over Postgres (not on-chain — the
    live `trades`/`pnl_snapshots` writer is `execution-runtime/src/pnlWrite.ts`,
    so polling Postgres is the only way to react to a close without new
    cross-package infra). It does two things: (1) unlocks `agent_skills`
    badges from `src/skillDefinitions.ts`'s static milestone checks (real
    trade count, sustained Sharpe, drawdown bound — reusing
    `REAL_TRADE_PREDICATE` so item 16's micro-trades can't farm them),
    purely informational in v1; (2) nudges a single `caution` scalar in
    `agent_strategy_params` upward when 3+ of an agent's last 5 real trades
    closed as losses within 60s, logging the reason to `agent_tuning_history`.
    Deliberately a heuristic, not RL — devnet's near-flat oracle gives no
    real training signal, and a heuristic is explainable for a grant demo.
    All three reference strategies became caution-aware (each widens its own
    threshold math, e.g. momentum's `thresholdBps *= 1 + caution`), resolved
    per-agent at construction time by `strategies/index.ts`'s now-`async`
    `createStrategyForAgent` via `src/strategyParamsClient.ts` — which falls
    back to `caution: 0` on any failure, so leaderboard-api being down never
    blocks runner startup.

    **Verified live in three stages, no seeded rows.** First, `pnl-indexer`'s
    real `npm run dev` against real backfilled Postgres: `skillEngine`'s
    first poll organically unlocked "Proven Track Record" and "Risk-Aware"
    for an existing devnet agent with 65 real trades already on record, and
    the new `GET /agents/:agentPda/params` plus the extended
    `GET /agents/:agentPda` (now carrying `skills`/`tuningHistory`) returned
    correct real rows including the `{caution: 0}` default for an untuned
    agent. The frontend's new Skills/Tuning Log panels were confirmed
    rendering both locked and unlocked states against that same live data.

    Second, the `caution` nudge actually firing. At `watcher-verify-1`'s
    default $10 size, devnet's flat oracle produces PNL that rounds to
    exactly $0.00 at 2 decimals nearly every time — too small for
    `realizedPnl < 0` to ever see. A new script,
    `backend/execution-runtime/scripts/verify-caution-trigger.ts` (same
    production-driver pattern as item 16's `generate-micro-trades.ts`, just
    with a larger configurable size), ran real $150 then $500 open/close
    round-trips until a natural run of losses landed in the most recent 5.
    `pnl-indexer` then logged `[skillEngine] CLqQSNFH... caution 0 -> 0.25
    (4 quick losses)`, confirmed against real `agent_strategy_params` and
    `agent_tuning_history` rows.

    Third, `execution-runtime` resolving that value into real strategy
    behavior — `scripts/verify-caution-effect.ts` called the real
    `fetchTunedParams()` against a live `leaderboard-api` (got back the
    organically-produced `0.25`, not a stub), then fed an identical
    synthetic 55bps price ramp to two real `MomentumStrategy` instances,
    one at `caution: 0` and one at the fetched `0.25`. The ramp crosses the
    default 50bps threshold but not the widened 62.5bps one: the untuned
    instance opened a position, the tuned one didn't, on the same input.
    That closes the chain end to end — skillEngine → Postgres →
    leaderboard-api → strategyParamsClient → strategy construction →
    strategy behavior — not just the network hop.
18. **Arena mode built and live-verified** (2026-08-02) — `docs/ROADMAP.md`'s
    Phase 2 item 3, implemented off-chain. `arena_seasons`/`arena_entries`
    in `pnl-indexer/schema.sql` are time-boxed seasons created by an
    operator script (deliberately not a public endpoint), which any agent
    owner can enter with a real wallet signature verified ed25519 via
    `tweetnacl` in `leaderboard-api/src/verifyOwnership.ts`. Scoring reuses
    the exact risk-adjusted/anti-gaming logic `GET /leaderboard` already
    ran — extracted into `leaderboard-api/src/scoring.ts` so both share one
    implementation — just scoped to the season's entrants and window
    instead of all agents and a rolling window. **No entry stake or prize
    pool**: free entry, no on-chain escrow, deliberately deferred out of v1
    (see "What's left").

    Users can also now tune their agent's real numeric strategy knobs
    (`thresholdBps`, `windowSize`, `gridSpacingBps`, `rsiLowerThreshold`,
    `rsiUpperThreshold`, `sizeUsd`) via a signed
    `PUT /agents/:agentPda/params`, merged into the same
    `agent_strategy_params` row item 17's auto-tuned `caution` writes to —
    `createStrategyForAgent` resolves the whole blob, so a user's tuning and
    the agent's own learned caution apply together rather than one
    clobbering the other.

    **Verified live**: a real season created; a real devnet wallet
    (`watcher-verify-1`'s owner keypair) signed and entered it, confirmed
    via a real `arena_entries` row and a correctly-ranked
    `GET /arena/seasons/:id` response carrying real Sharpe/ROI numbers; a
    tampered signature confirmed rejected; a real signed
    `thresholdBps: 120` tune confirmed merged alongside the existing
    `caution: 0.5` rather than overwriting it; an out-of-bounds value
    confirmed rejected by validation; `MomentumStrategy` confirmed applying
    both values together on a real threshold check
    (`scripts/verify-tuned-threshold.ts`); and both new frontend pages
    (`/arena`, `/arena/[seasonId]`) confirmed rendering real data and
    failing gracefully with `leaderboard-api` down.

    **Found a real user-facing bug live in the browser that typechecking
    couldn't reach** — the Enter Arena modal hung forever on "Loading your
    agents...", from two independent bugs stacked. (1) `leaderboard-api` had
    zero CORS config, because every prior consumer runs in a Next.js Server
    Component (server-to-server, not subject to browser CORS);
    `EnterArenaModal.tsx`'s `fetchMyAgents()` is the *first* client-side
    fetch in the whole app, and the browser blocked it into an opaque
    `TypeError`. Fixed with `app.use(cors())` before the routers —
    permissive is fine here since every mutating route is gated by a wallet
    signature, not cookies, so an open origin hands out no write capability
    an attacker didn't already have by calling the API directly. (2)
    Independently, the modal nested its error branch *inside* the
    `myAgents && myAgents.length > 0` block, so a throw that left `myAgents`
    null set the error but never rendered it. Fixed by hoisting the error
    above the `myAgents`-dependent branches. Lesson worth keeping: the first
    client-side fetch in a new feature is exactly where a CORS gap surfaces,
    no matter how long everything else has worked server-side.

19. **Ran the copy-trading and anti-gaming verification scripts, and found +
    fixed two real holes in `velocityWatcher.ts`** (2026-08-06). Three of the
    four new scripts had already been run when this session started (their
    results were sitting in Postgres); verifying those outcomes against real
    `GET /agents/:agentPda` calls is what exposed the bugs.

    **Outcomes verified as passing.** `attack-rapid-round-trip.ts` →
    `copy-follower-1` returns `isWashTraded: true`, *"High frequency rapid
    round-trips detected (5 trades <10s)"*. `attack-pnl-divergence.ts` →
    `pnl-divergence-attacker` returns `isWashTraded: true`, *"Self-reported
    PNL diverges from on-chain-verified PNL on 2 trade(s)"* — the
    trust-minimization story working end to end, a tampered
    `realized_pnl: 9999` contradicted by on-chain `settledPnl: 0`.
    `verify-copy-mirror.ts` → trades #423/#424, source `watcher-verify-1` at
    $25 and follower `copy-follower-1` at $10, opened 1.0s apart: the mirror
    genuinely uses the *follower's* subscribed size, not the source's.
    Control group holds — `watcher-verify-1` (98 valid trades) correctly
    returns `isWashTraded: false`, so the heuristics aren't just flagging
    everything.

    **But both attacks cleared their thresholds with zero margin, and that
    turned out to be the finding.** The divergence attack tampered 7 trades
    and only 2 were ever reconciled; the other 5 sat at
    `onchain_verified_pnl: NULL` forever. `antiGaming.ts` needs 2 to flag, so
    it caught this by exactly nothing. Two independent root causes, both in
    `velocityWatcher.ts`:

    *Bug 1 — the watcher only ever reconciled the newest unverified trade.*
    `store.ts`'s `getMostRecentUnverifiedClosedTrade` was `ORDER BY closed_at
    DESC LIMIT 1`. When closes arrive faster than the 5s poll they pile up,
    and each poll reconciled only the latest while permanently abandoning the
    older rows — nothing ever revisited them. Provable in the data: trade
    #436 closed 09:30:46 and was verified 09:30:59, and in that 13s window
    #437 had already opened *and* closed. The old comment on that function
    assumed "at most one relevant close per agent between polls" and offered
    the rapid-round-trip heuristic as a backstop; that backstop doesn't hold,
    since it needs 5+ sub-10s trades, so a slower attacker evades it while
    still outrunning the poll. **Fix**: renamed to `getUnverifiedClosedTrades`,
    `ORDER BY closed_at ASC` with no `LIMIT`, and `reconcileClose` drains the
    whole batch.

    One judgment call inside that fix: when N closes pile up in one poll
    window, the `settledPnl` delta is their *collective* PNL and can't be
    split per-row from account-state polling alone. So the comparison is
    aggregate — sum the self-reports, compare against the one on-chain
    number, write that same verdict to every row in the batch. Attributing
    the full delta to each row individually would manufacture divergences
    that aren't real, which matters a lot when 2 flags condemn an agent. The
    tradeoff: for a multi-row batch, `onchain_verified_pnl` holds the batch
    total rather than that row's own share.

    *Bug 2 — a round-trip that opened AND closed entirely between two polls
    was invisible.* `baseAssetAmount` can't distinguish "still holding the
    same position" from "closed and reopened at the same size and direction"
    — both look identical at both ends, so the poll fell through to the
    "still open, keep the baseline" branch and the whole cycle vanished. This
    is exactly what the attack exploited, reopening 1–2.6s into a 5s poll.
    **Fix**: `UserAccount.nextOrderId` (monotonic, incremented per order
    placed, already on the polled account — no extra RPC; the SDK documents
    `nextOrderId - 1` as "the most recently placed order") is now tracked in
    `PositionState`. If the position stayed open in the same direction but
    `nextOrderId` advanced by **more than one**, at least one full
    close-and-reopen happened unobserved. The `+1` tolerance is deliberate:
    one new order is the ordinary close-then-open cadence the other branches
    already cover. All four transition branches now carry `nextOrderId`
    forward — leaving it stale in the "still open" branch would have made the
    new check misfire.

    **Both fixes verified live, against a real re-run of the attack** (3
    rounds, real devnet trades, `pnl-indexer` running with
    `VELOCITY_WATCHER_DEBUG=1`). The log caught each fix firing distinctly:

    ```
    [velocityWatcher][3aubWc87...] detected 2 orders since last poll while
      position stayed open — at least one close/reopen happened between polls.
    [velocityWatcher][3aubWc87...] verified 8 backlogged trades
      (#434..#443, aggregate): self-reported $59993.99 vs on-chain $0.00 — DIVERGENCE FLAGGED
    [velocityWatcher][3aubWc87...] verified trade #444: self-reported $9999.00 vs on-chain $0.00 — DIVERGENCE FLAGGED
    [velocityWatcher][3aubWc87...] verified trade #445: self-reported $9999.00 vs on-chain $0.00 — DIVERGENCE FLAGGED
    ```

    Result: **3 of 3 tampered trades caught, versus 2 of 7 before**, and
    `still_unverified: 0, flagged: 12, total: 12` on the attacker — every
    trade now verified, with the flag no longer depending on luck. Note the
    batch path and the single-trade path both appear above, confirming the
    batch drain doesn't swallow subsequent trades.

## Venue blocker cleared 2026-07-23 — migrated Drift to Velocity

The `DriftClient.deposit()` outage below was never fixed on Drift's own
devnet — it was worked around by migrating off it. Drift rebranded to
**Velocity DEX** after its mainnet exploit and ships its own separate devnet
deployment (`docs.velocity.exchange` confirms on-chain state does not carry
over from Drift v2). Before adopting it, the same four checks this project
always runs on a venue were done for real: its own docs, SDK freshness (18
npm releases, latest shipped the day before adoption), *successful* devnet
transactions (not just "the client loads"), and the client actually
subscribing and loading markets. A standalone script proved, with real
on-chain transactions: deposit succeeds (the exact op broken on Drift's old
devnet), delegated open/close succeeds, and a delegate-attempted withdrawal
is rejected. Full evidence, transaction signatures, and the technical
differences (new program id, new SDK, `dUSDT` collateral instead of USDC)
are in `docs/VENUE-EVALUATION.md`'s migration addendum and `CLAUDE.md`'s
Execution venue section.

`backend/execution-runtime/src/drivers/velocityDriver.ts` and
`frontend/hooks/useVelocity.ts` (renamed from `useDrift.ts`) are migrated to
`@velocity-exchange/sdk`, typecheck clean, and the backend builds clean.
`useVelocity.ts` is now wired into the create-agent flow and verified
end to end with a real wallet (see item 9 below); `runner.ts`'s tick loop
has now been run for real too, against a real delegated agent, with a real
trade confirmed on-chain (see item 10 below).
`scripts/velocity-devnet-vault-test.ts` supersedes
`scripts/drift-devnet-vault-test.ts` as the manual one-shot vault proof
going forward.

The three pre-migration Drift debug scripts (`scripts/drift-devnet-vault-test.ts`,
`inspect-drift.ts`, `test-swap-deposit.ts`) were uncommitted, in-progress
debugging work investigating the now-superseded `SpotMarketNotFound` bug —
left untouched at first during the migration rather than overwritten
without asking, then deleted the same day once confirmed. `npm run build`
is clean.

## What's left — no longer blocked on external infra

- leaderboard-api's wash-trading heuristics (item 12) are implemented and
  live in `GET /leaderboard`. The micro-trade threshold is now live-verified
  against a real trade sequence (item 16) — the rapid-round-trip (<10s) and
  PNL-divergence thresholds are still unexercised by a real gaming attempt.
  Position-size heuristics beyond the micro-trade floor are still not
  built.
- A dedicated devnet RPC for `execution-runtime` — the public devnet RPC
  it's currently pointed at throttles hard enough under sustained polling
  to crash the standing process (mitigated, not fixed, by the
  `unhandledRejection`/`uncaughtException` handlers added in item 10).
  **Update 2026-08-10: this needs a *paid* plan — all three major free tiers
  were tested directly and every one is unusable**, each blocking a
  different method (Helius: batch requests; Alchemy: `getProgramAccounts`;
  QuickNode discover: `getMultipleAccounts` capped at 5 per call). Full
  detail in `CLAUDE.md`'s RPC gotcha. `scripts/check-rpc-batching.ts` runs
  the check in about a minute against any candidate URL — read-only, no
  funds, and it exercises a real `VelocityClient.subscribe()` rather than a
  shallow `getSlot`, which passes on all three unusable tiers. Until a paid
  plan exists, **public devnet is the correct choice**, not a free "dedicated"
  endpoint.
- ~~`velocityWatcher.ts`'s reversal-blind-spot~~ — fixed and live-verified
  in item 15 (2026-08-01, forced reversal script).
- `momentum-sol-1`/`momentum-sol-3` (the two real registered agents used
  for item 10) share one underlying Velocity vault that's now short on
  collateral for a $10 position — not re-funded, since that vault's owner
  key was a real Phantom wallet from earlier frontend testing, not
  something this session holds. `watcher-verify-1` (a fresh throwaway test
  agent, PDA `CLqQSNFHXeoPd3siR2fZxTB31QAyCNid5ymXBpoTutn4`) is the
  currently-funded, currently-working agent for any further live testing.
- **[RESOLVED 2026-08-08] Circuit-breaker independence verified live, which
  also closes item 14's outstanding gap.** `scripts/verify-circuit-breaker-
  independence.ts` — previously the one new script with no evidence it had
  ever run — passed on its first run against real devnet.

  Setup: source `watcher-verify-1` opens a real $5 long each round while the
  follower `copy-follower-1` mirrors at an absurd $250,000, far beyond its
  ~1000 dUSDT collateral, so the mirrored `openPosition` genuinely rejects
  on-chain (`InsufficientCollateral`, error 6003, real margin calculation in
  the program logs — not a simulated failure). Drives `runner.ts`'s real
  exported `executeDecision`, not a reimplementation.

  Result after 3 rounds: `source.consecutiveFailures=0 disabled=false |
  follower.consecutiveFailures=3 disabled=true`, and re-fetched on-chain,
  source `active` (never touched) with follower `paused` via a real
  `authority_pause` (tx `2S8HbHij…`). **RESULT: circuit breaker independence
  CONFIRMED.** A follower's failures trip only its own breaker — the point
  of replaying into the follower's own `ManagedAgent` rather than sharing
  the source's counters.

  This is also the first real repeated-failure scenario since item 14's
  `confirmAction` fix, so it confirms the breaker now trips correctly
  instead of oscillating between failure modes. Item 14's "not yet
  re-verified live" caveat is closed.

  **Two corrections to the cautions previously listed here.** (1) The claim
  that it "mutates a real `copy_subscriptions` row, so a mid-script failure
  leaves a poisoned subscription behind" is **wrong** — only the script's
  own doc comment says that. The code passes `ABSURD_FOLLOWER_SIZE_USD`
  in-memory to `CopyStrategy` and the `followersBySource` map and never
  writes to Postgres. Confirmed by reading it and by the row being unchanged
  afterward. (2) The `runner.ts`-must-be-stopped caution is real and still
  applies. **The actual hazard nobody had recorded**: the script leaves
  `copy-follower-1` genuinely `paused` on-chain, and `RegistryClient` has
  **no** `setStatus` method — only `authorityPause` — by deliberate design,
  since the delegated authority key must never be able to reverse a pause.
  Reactivating needs the agent *owner*'s signature via `set_status`, so
  **don't run this without holding the follower's owner keypair**
  (`copy-follower-owner-keypair.json`, owner `FXEJT3Cm…`). Restored here
  with a one-off `set_status({active:{}})` (tx `LfayHPVY…`), verified back
  to `Active` through a real `GET /agents/:agentPda`.
- **`velocityWatcher.ts`'s new `nextOrderId` check narrows the
  between-polls blind spot but doesn't eliminate it** (item 19). It reliably
  detects *that* a close/reopen was missed, but the `settledPnl` delta it
  reconciles is still collective across everything that settled in that
  window — so per-trade attribution for a burst remains unavailable from
  account-state polling alone. Splitting it properly needs a per-close
  on-chain marker; the SDK exposes a `SettlePnlRecord` event type that
  looks like the right primitive, and event-log subscription rather than
  state polling is the real long-term fix.
- **`skillEngine`'s `caution` ratchets up on `watcher-verify-1` from repeated
  test-attack losses** — observed going `1.5 -> 1.75` during item 19's run.
  At 1.75 momentum's threshold is 2.75× the default (50bps → 137.5bps),
  which may effectively silence that agent on devnet's flat oracle. **Reset
  to 0 on 2026-08-08**, verified through `GET /agents/:agentPda/params`
  returning `{"caution":0}`, not just the Postgres write:

  ```sql
  UPDATE agent_strategy_params
  SET params = params || '{"caution": 0}'::jsonb
  WHERE agent_pda = 'CLqQSNFHXeoPd3siR2fZxTB31QAyCNid5ymXBpoTutn4';
  ```

  Use the JSONB merge, not an overwrite — `skillEngine` and the signed
  `PUT /agents/:agentPda/params` both write into this same row, so replacing
  it wholesale would clobber a user's tuned `thresholdBps`/`sizeUsd`
  alongside the caution reset. **This reset is not durable**: `skillEngine`'s
  15s poll will ratchet it straight back up after another run of quick
  losses, so do it immediately before a demo, not well ahead of one.
- **[RESOLVED 2026-08-08] The `leaderboard-api` port mismatch was real, but
  recorded backwards.** The 2026-08-06 note here claimed the API was running
  on :4001 because "an unrelated `server/server.js` holds :4000". On
  re-check: there is no `server/` directory in this repo, and nothing was
  listening on :4000 or :4001 at all (`lsof -nP -iTCP:4000 -sTCP:LISTEN`
  empty for both). The actual mismatch ran the other way —
  `backend/leaderboard-api/.env` sets `PORT=4000` and
  `frontend/lib/leaderboardApi.ts`'s hardcoded fallback is `:4000`, but
  `frontend/.env.local` had been pointed at `:4001`, which overrides that
  fallback. So the API would have come up on 4000 while the browser looked
  for it on 4001. **Fixed** by pointing `.env.local` back at `:4000`, the
  value every other config already agreed on. Verified live, not just edited:
  `leaderboard-api listening on :4000` and `GET /leaderboard` → HTTP 200.
  Worth noting the failure mode this would have caused is the same opaque
  client-side `TypeError` as the arena CORS bug (item 18) — a wrong port and
  a missing CORS header are indistinguishable from the browser's side, so
  check both when a client-side fetch fails for no visible reason.
- **[RESOLVED 2026-08-08] Flagged agents *are* demoted on `GET /leaderboard`
  — the 2026-08-06 "not confirmed" note was a bad test, not a real gap.**
  That entry asked whether the attack agents were missing because the
  eligibility gate filtered them before scoring, or because `antiGaming`
  wasn't computed on the list endpoint. It's the first, and it's correct
  behavior. Two independent filters were being conflated:

  1. **The SQL eligibility gate** (`routes/leaderboard.ts`'s
     `WHERE ($2::boolean = true OR (a.leaderboard_eligible = true AND
     a.trade_count >= $3))`) runs *before* `rankAndEnrich` is ever called.
     Both attack agents carry `leaderboard_eligible = false` with 9 trades
     against a 50 minimum, so they never reach the scoring path on the
     default query. This is the on-chain minimum-track-record rule working
     as designed — an agent can't buy leaderboard presence with 9 wash
     trades.
  2. **With `?all=true`** (which bypasses only that gate) both appear and
     are correctly flagged, sorted to the bottom with `rank: null`:
     `pnl-divergence-attacker` → *"Self-reported PNL diverges from
     on-chain-verified PNL on 12 trade(s)"*; `copy-follower-1` → *"High
     frequency rapid round-trips detected (5 trades <10s)"*. The four
     legitimate agents sit above them, unflagged.

  Two traps that made the original check read as a failure, worth not
  re-deriving: (a) the default endpoint hides these agents behind the
  eligibility gate, so absence there proves nothing about anti-gaming;
  (b) **the list endpoint flattens the fields** to `wash_trading_flagged` /
  `flagged_reason` / `valid_trade_count`, while `GET /agents/:agentPda`
  nests them under `antiGaming` — looking for the nested key on the list
  response finds nothing even when the data is present.

  Note the divergence count now reads **12, up from the 2 recorded in item
  19** — that's item 19's backlog-drain fix working: trades that previously
  sat at `onchain_verified_pnl: NULL` forever are now all reconciled.

  Demo command, since "flagged agents sort below legitimate ones" is worth
  being able to show a grant reviewer directly:

  ```bash
  curl -s "http://localhost:4000/leaderboard?all=true" | jq '.agents[] | {agent_id, wash_trading_flagged, flagged_reason, rank}'
  ```

  The stronger framing for a pitch is defense in depth, not sorting: layer
  one is the on-chain 50-trade minimum the attackers never cleared, layer
  two is the heuristic set that catches them the moment you look past it.
- **[RESOLVED 2026-08-08] `ranked_count` is now 2 — a real second agent
  cleared every gate.** `momentum-sol-2` (PDA
  `7aFCHFS9Fpaw2R1bN5g8RNBv29YuJcaYUnXKuNgfwuum`, owner keypair
  `momentum-sol-2-owner-keypair.json`) was registered, funded with 1000
  dUSDT, Velocity-delegated and registry-authorized via the existing
  `scripts/setup-copy-follower.ts` (already parameterized —
  `SETUP_AGENT_ID` / `SETUP_OWNER_KEYPAIR_FILE`, no new script needed), then
  driven to a real track record by `scripts/build-track-record.ts`.

  Final state: `leaderboard_eligible: true`, `trade_count: 50`,
  `verified_trade_count: 51`, `isWashTraded: false` (51 valid trades, 0
  micro-trades, 0 divergences). `GET /leaderboard` returns
  `ranked_count: 2`, with `momentum-sol-2` at rank 1 (sharpe 1.00) above
  `watcher-verify-1` at rank 2 (sharpe -2.60) — a real risk-adjusted
  ordering, not a tie. Both attack agents stay flagged and unranked, so the
  anti-gaming layer still holds with a new agent present.

  **Why the other three "eligible" agents were never candidates**, since
  this isn't obvious from the agents table: `agent-776326`, `agent-379162`
  and `agent-127288` are all `Paused`, owned by `5oE1qrgM…` — a key that is
  **not in this repo**, so they can't be reactivated from here. They also
  have *zero* `trades` rows: their `trade_count: 50` came from looped
  `record_trade` calls with no fills behind them, which is exactly the
  attack `verified_trade_count` exists to catch. `copy-follower-1` was the
  only other agent whose key is held, and it is permanently flagged from
  `attack-rapid-round-trip.ts` — the rapid-round-trip rule has no decay, so
  clean trades can never clear it. A fresh agent was the only correct route.

  Two things learned running it, both worth knowing before repeating this:
  - **~7% of cycles are lost to devnet RPC lag** (3 of 45 in run 1, 0 of 14
    in the top-up). The failure is always the same: the open never fills, so
    the close computes `base_asset_amount=0` against
    `market.order_step_size=100000` and every retry correctly fails against
    a position that doesn't exist. Verified on-chain (`baseAssetAmount: 0`)
    that these leave **no dangling position** — the script counts the cycle
    failed and moves on, no cleanup needed. Size any run with margin above
    the target; 45 cycles does not produce 50 verified trades.
  - **Don't gate a chained follow-up run on `pgrep -f "build-track-record"`.**
    The waiting shell's own command line contains that string, so `pgrep`
    matches itself, the wait never ends, and the follow-up silently never
    starts — while every `pgrep`-based progress check reports it as running.
    Poll the database condition (`count(onchain_verified_pnl)`) instead, or
    match the real process (`node dist/scripts/build-track-record`).

  Still true and worth a demo caveat: `pnl-divergence-attacker` renders in
  the frontend's "Pending On-Chain Verification" table showing `roi
  9999.00%` / `sharpe 7.42`. It is correctly unranked, but the fake number
  is visible on screen — point at it deliberately as the tampered
  self-report the watcher caught, rather than letting a reviewer find it.
- **Both `runner.ts` and `velocityWatcher.ts` fix their agent set at
  startup** — a newly delegated agent isn't traded or watched until a
  restart. Acceptable for a demo, wrong for sustained operation.
- **Arena mode has no entry stake or prize pool** (item 18) — seasons are
  free-entry with no on-chain escrow, deliberately cut from v1. The
  ROADMAP's Phase 2 item 3 also calls for shareable auto-generated result
  cards, which aren't built.
- **Position-size caps relative to vault size** (ROADMAP Phase 2
  anti-gaming item 2) are still not built — only the micro-trade *floor*
  exists.

## Not blocked — pick these up any time

Nothing left in this repo is waiting on external infra. Phase 1 and Phase 2
of `docs/ROADMAP.md` are both complete, including arena mode (item 18).
The next unbuilt product surface is **Phase 3 — subscribe/copy-trade
marketplace**, which can lean on Velocity's manager/follower vault
primitive (`managementFee`, `profitShare`) rather than inventing one, plus
its notification layer. After that, Phase 4's security pass
(`solana-program-test` attack-vector coverage, permission-scope audit) and
the grant deliverables (architecture diagram, demo video, narrative).

The single highest-leverage infra item remains a **dedicated devnet RPC**,
which would make long unattended demo runs reliable. Note the two things it
was previously credited with unblocking are now both done on public devnet
anyway: the circuit-breaker verification passed (2026-08-08) and the
rapid-round-trip threshold was exercised by a real attack script
(2026-08-06). So this is a reliability upgrade, not a blocker — and since
every free tier is ruled out (see above), it costs money rather than time.
Public devnet's ~7% cycle-loss rate under sustained load is real but
survivable: size trade runs with margin rather than assuming every cycle
lands.

## Milestone check

The original milestone is now fully hit for a single real trade — the whole
pipeline (registry → runtime → indexer → leaderboard → frontend) is wired
and verified end to end, trade included:

- Register an agent on devnet ✅ (done, verified)
- Watch it trade autonomously on Velocity devnet ✅ (done, verified 2026-07-23
  — `momentum-sol-1` opened, closed, and recorded a real trade via
  `runner.ts`'s live tick loop)
- See it show up on a public leaderboard with real PNL/ROI ✅ (done, verified
  2026-07-23 — real `trades` and `pnl_snapshots` rows now exist in Postgres
  from `momentum-sol-1`'s real close, with correct ROI/Sharpe math; these
  are written by `execution-runtime` self-reporting, per item 11's tradeoff.
  Item 13's independent watcher reconciles against that self-report rather
  than replacing it, and **has since been verified against a real devnet
  close** — see item 13's 2026-07-31 addendum.)

This is the grant-application demo, and it now carries more than the
original milestone: agents also earn skill badges and auto-tune their own
caution from real losses (item 17), and can compete in time-boxed arena
seasons scored by the same anti-gaming logic (item 18) — both live-verified
against real devnet trades and real signed wallet entries, not just
typechecked.

Everything remaining is Phase 3+ per `docs/ROADMAP.md`: the
subscribe/copy-trade marketplace, notification layer, the security pass, and
mainnet migration.

## Notes for whoever (or whatever) is building this

- Don't skip a manual venue test before automating on top of it — that's
  exactly what surfaced the Drift deposit bug before it could waste time
  inside a running execution-runtime loop.
- Keep PNL math out of the Anchor program — compute off-chain in
  pnl-indexer, as laid out in `docs/ARCHITECTURE.md`. The registry only
  tracks identity/status/trade-count.
- Use a dedicated devnet RPC (Helius/QuickNode) for anything beyond a
  handful of transactions — but check `CLAUDE.md`'s gotcha about Helius's
  free tier rejecting the batch RPC calls some SDK code depends on first.
- Before adopting any new dependency or venue, verify it against real
  devnet state yourself — don't trust a comparison table or a package's own
  claims. This repo's `docs/VENUE-EVALUATION.md` is a record of two cases
  (Zeta, Flash Trade) where that check caught something that looked fine on
  paper but wasn't.
