# frontend

Public-facing app: leaderboard, agent profiles, create-agent flow, arena
standings. Phase 3 adds the subscribe/copy-trade UI.

## What's here

- `app/create/page.tsx` — the create-agent flow. Calls `register_agent` on
  the deployed `viperx_agent_registry` program directly from the connected
  wallet (the user signs; this app never custodies funds or keys). Verified
  with a real Phantom wallet against live devnet.
- `app/leaderboard/page.tsx` — ranked agent table, reading `leaderboard-api`'s
  `GET /leaderboard`. A Server Component (`fetch(..., { cache: "no-store" })`
  on each request, not client-side) with window switching (`?window=`) via
  plain links, no client JS needed for that. Verified against a real running
  `leaderboard-api` (correct data, window switching) and with it stopped
  (clean error message, no crash, no console error, recovers once it's back).
- `app/providers.tsx` — wallet adapter context (Phantom/Solflare + Wallet
  Standard auto-detection), devnet by default.
- `lib/registry.ts` — thin Anchor client for the registry program, reading
  the vendored `idl/viperx_agent_registry.json` as the program-ID source of
  truth (no `REGISTRY_PROGRAM_ID` env var needed — the IDL already bakes it
  in via its `address` field).
- `lib/leaderboardApi.ts` — typed fetch client for `leaderboard-api`, base
  URL from `NEXT_PUBLIC_LEADERBOARD_API_URL` (falls back to
  `http://localhost:4000`). Note `trade_count`/`roi_pct`/etc. come back as
  strings, not numbers — `pg` serializes `BIGINT`/`NUMERIC` as strings to
  avoid precision loss, and the API passes that straight through.
- `app/agents/[agentPda]/page.tsx` — agent profile page, reading
  `leaderboard-api`'s `GET /agents/:agentPda`. A Server Component, same
  fetch pattern as the leaderboard page. Renders agent stats (status, trade
  count, latest ROI/Sharpe/drawdown), strategy URI, full trade history, and
  PNL-snapshot history. Linked from every leaderboard row. 404s via Next's
  `notFound()` for an unknown PDA; fails gracefully (no crash) with
  `leaderboard-api` down. Verified against real backfilled agent data.
- `hooks/useVelocity.ts`, `lib/velocity.ts`, `types/velocity.ts` — a
  wallet-connected Velocity DEX client (init user account, deposit
  collateral, delegate trading rights, open a position), migrated 2026-07-23
  from an earlier `@drift-labs/sdk`-based spike
  (`useDrift.ts`/`lib/drift.ts`/`types/drift.ts`, now removed). Builds its own
  `Program<Velocity>` via `@coral-xyz/anchor` rather than using
  `VelocityClient` — that class is entirely blocked in this SDK's browser
  build (see the Gotcha below), found real-wallet-testing this hook.
  Verified end to end with a real connected wallet against live devnet
  (2026-07-23): init, deposit, delegate all signed and confirmed.
- `components/create/FundAndDelegate.tsx` — wired into `app/create/page.tsx`,
  rendered once `register_agent` confirms. Four gated steps, each a separate
  signature: initialize a Velocity account, deposit SOL collateral, delegate
  trading rights to the execution runtime (Velocity's own
  `updateUserDelegate`), and separately authorize that same runtime key on
  the registry (`set_authority`) so it can call `record_trade`/`authority_pause`
  — two different programs, two different delegations, both needed before
  the runtime can manage the agent. Each step's "done" state reads real
  on-chain fields (`userAccount.totalDeposits`, `userAccount.delegate`, the
  registry's `agent.authority`, fetched on mount) rather than the hook's
  last-action status, which would make an earlier step's checkmark disappear
  the moment a later step's transaction lands. **Verified end to end with a
  real connected wallet against live devnet** (2026-07-23): fresh
  registration through all four fund/delegate steps, signed and confirmed.
- Not yet built: arena view (Phase 2+, needs `backend` support for
  competition windows).

## Setup

```bash
npm install --legacy-peer-deps
npm run dev
```

`idl/viperx_agent_registry.json` is a vendored copy of the root `idl/`, same
pattern as `backend/execution-runtime` — re-copy it from there after any
program change, don't hand-edit it.

`@velocity-exchange/sdk` bundles its own `@solana/web3.js`, and so does
`@solana/wallet-adapter-react` (a different version). If npm nests a second
copy of either, every `Connection`/wallet type silently stops matching across
the boundary — dozens of confusing errors that all vanish once deduped.
`package.json`'s `overrides` block (the `"."`-pinning form, not a plain
nested override) handles this; verify with
`find node_modules -mindepth 3 -path '*/node_modules/@solana/web3.js'`
after any dependency change — it should print nothing. `--legacy-peer-deps`
is needed at install time for an unresolved transitive peer conflict
somewhere in `@velocity-exchange/sdk`'s tree — `next build` and
`tsc --noEmit` both come back clean afterward.

`@velocity-exchange/sdk`'s "browser" build still ships a Node-only
`loadKeypair` CLI helper that unconditionally `require("fs")` at module
scope, even though nothing in this app calls it — `next build` fails
outright without `next.config.ts`'s `turbopack.resolveAlias`, which stubs
`fs` to `lib/shims/fs-browser-shim.js` for the client bundle only. Don't
widen that alias to apply unscoped: a blanket `fs` alias breaks unrelated
server-side deps that legitimately need real `fs` during SSR (`qrcode`,
`@coral-xyz/anchor`'s `nodewallet`, the mobile wallet adapter) — scope it to
the `browser` condition, as it is now.

`VelocityClient` (the SDK's high-level client) is entirely blocked in the
browser build — its `AnchorProvider`/`Program` throw `"...not supported in
the browser build. Use VelocityCore instead."` at construction time, a
deliberate SDK restriction, not a bug to work around. `VelocityCore` (the
suggested replacement) only wraps a subset of instructions and has no
`initialize_user`/`update_user_delegate` builder yet. `useVelocity.ts`
works around both by constructing its own real `Program<Velocity>` via
`@coral-xyz/anchor` + `VelocityCore.defaultIdl()`, and calling
`program.methods.X(...)` directly where `VelocityCore` doesn't have a
wrapper. See `CLAUDE.md`'s Gotchas for the full detail, including the
manual SOL→WSOL wrap-and-sync steps this required for deposits.

## Remaining build order

Nothing outstanding right now — the create-agent → fund/delegate flow is
built, wired, and verified end to end with a real wallet (2026-07-23).
Arena/competition view is the next real gap (Phase 2+, needs `backend`
support for competition windows).

## Env vars (`.env.local`, optional)

```
NEXT_PUBLIC_RPC_URL=<dedicated devnet RPC>              # falls back to clusterApiUrl("devnet") if unset
NEXT_PUBLIC_LEADERBOARD_API_URL=http://localhost:4000   # falls back to localhost:4000 if unset
NEXT_PUBLIC_RUNTIME_PUBKEY=<execution runtime's public key>  # no fallback — unset disables the
                                                              # delegate-to-runtime and authorize-
                                                              # runtime steps in FundAndDelegate
                                                              # rather than pointing at the wrong
                                                              # key silently. Must match whichever
                                                              # keypair RUNTIME_KEYPAIR_PATH in
                                                              # backend/execution-runtime/.env
                                                              # resolves to.
```
