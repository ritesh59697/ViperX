# Execution venue evaluation

Verified 2026-07-15 against npm, the deployed programs on-chain, and each project's own docs —
not from summaries or comparison tables. Re-verify before acting on this; venues change fast, as
this document exists to prove.

## Conclusion

**Stay on Drift for devnet.** It is the only venue evaluated that has, simultaneously: a working
devnet, a maintained SDK, and real delegated trading authority. It is also what the repo is
already built for.

Mainnet is a separate, later decision — Drift mainnet was exploited and is now Velocity DEX.
Nothing below changes Phase 1–4.

## What was checked

Four checks, in cost order. A venue must pass all four.

1. **Docs** — does the project's own documentation say it is alive? (Marketing pages lie.)
2. **SDK** — has the client library shipped recently?
3. **Chain** — does the devnet program have *successful* recent transactions?
4. **Load** — does the client actually connect and load markets?

## Results

| Venue | Devnet | Delegation | SDK last shipped | Verdict |
|---|---|---|---|---|
| **Drift** | **Alive** — 30 perp markets, SOL-PERP `active` | **Yes** — `updateUserDelegate()` | 2026-05-11 | **Use this** |
| Flash Trade | Deployed, but 0 successful txs | **No** — see below | 2026-06-23 | No |
| Percolator | Exists | Not delegation (see below) | no npm SDK | Too early |
| Phoenix Perps | Private beta, no open devnet | n/a | 2024-04-28 | Not yet |
| Jupiter Perps | Mainnet only | n/a | n/a | No |
| Mango v4 | Stale | Historically yes | 2024-12-10 | No |
| Zeta Markets | **Dead** — ceased operating May 2025 | API exists, venue doesn't | 2025-09-17 | **Never** |

## Why Flash Trade fails, despite looking like the best option

A comparison table ranked Flash Trade #1 at five stars, citing "strong native delegate → trade
flow." **That claim is false**, and it fails the one check that matters most for a non-custodial
agent hub.

Checked against the IDL shipped in `flash-sdk@15.17.2` (program `FLASH6Lo…`):

- The string `delegate` appears **exactly once** in the entire IDL — as a field on the `Position`
  type. It is vestigial: nothing sets it and nothing reads it.
- Across all **117 instructions**, there is no `set_delegate` / `edit_delegate` equivalent.
- The complete set of signer account names is: `admin`, `authority`, `fee_payer`, `owner`,
  `payer`, `signer`, `upgrade_authority`. No delegate.
- `open_position` and `close_position` both require **`owner` as a signer**.

So an agent cannot trade a user's Flash position without the user's own key. That is precisely the
custody model ViperX exists to avoid.

Other corrections to that table:

- *"Excellent devnet"* — the program is deployed to devnet, but of the transactions in retained
  history, **all failed** (Anchor `ConstraintAddress` / `ConstraintSeeds`) and **none succeeded**.
  It looks uninitialized. Flash *mainnet*, by contrast, is genuinely busy.
- *"Easy self-deploy on devnet"* — this points at `flash-trade/flash-perpetuals`, which is a
  **fork of Solana Labs' perpetuals reference implementation, last pushed 2023-10-24**. It is not
  the source of the live Flash program. Self-deploying it means running a 3-year-old reference
  perps engine, not Flash Trade.
- **Percolator** is real (unveiled by Anatoly Yakovenko) and actively developed, but it is
  explicitly *"experimental and unaudited… not for production or real funds,"* with mainnet in
  "lab mode" pending audit. The table's "very strong delegation (permissionless + composable)" is
  a category error: *permissionless* means anyone can launch a market; it does not mean a delegate
  key can trade your account.
- **Phoenix Perps** (private beta) and **Jupiter Perps** (mainnet only) were rated accurately.

## Addendum 2026-07-16: `deposit()` is broken for every market on this devnet deployment right now

While running the manual delegation test (`backend/execution-runtime/scripts/drift-devnet-vault-test.ts`,
per `NEXT_STEPS.md` step 2), `DriftClient.deposit()` fails on-chain every time, for every market
tried, with the same error:

```
Program log: Could not find spot market <N> at programs/drift/src/instructions/user.rs:694
AnchorError ... SpotMarketNotFound. Error Number: 6087.
```

**This was first found depositing native SOL (market 1) and initially suspected to be SOL-specific.
It is not.** Re-tested with a fully valid deposit into market 0 (USDC) — a real devnet USDC balance
in the correct ATA, correct mint confirmed live against the client (`8zGuJQqwh...`, matching
`getSpotMarketAccount(0)` exactly) — and it fails identically: same error, same instruction count,
same compute units consumed (14,162), just a different market index in the message. Two markets,
two independently-valid account sets, byte-for-byte the same failure. That rules out anything
specific to our code or to native-SOL wrapping — **`deposit()` does not work at all on this devnet
deployment right now, for any market.**

Ruled out along the way:
- Client-side account resolution is correct: `getSpotMarketAccount(N)` reads back `status: active`,
  correct mint, correct PDA in both cases, and the built instruction's account list was confirmed
  (by direct construction) to include the right PDA.
- Not a stale-SDK problem: `2.156.0` is npm's newest **stable** release (2026-01-27). The `latest`
  dist-tag (`2.163.0-beta.13`, 2026-05-11) was tried too — it's worse, `DriftClient.subscribe()`
  itself crashes decoding a market account. Reverted to 2.156.0.
- Not a wrong-account-type mistake: an earlier, genuinely-invalid market-0 attempt (passing a wallet
  pubkey instead of a token account) failed with a *different*, expected error
  (`AccountOwnedByWrongProgram`) — proving the harness can tell "wrong account" apart from this
  failure, and that this really is a distinct condition.
- No funds were lost testing this: every attempt failed at the preflight simulation stage, before
  submission, confirmed by re-checking the owner's SOL balance was unchanged after both attempts.

**Likely cause, now backed by evidence, not just a guess:** `github.com/drift-labs/protocol-v2` is a
live HTTP 301 redirect to `github.com/velocity-exchange/protocol-v2`. In that repo's history:

- **`e32903b`, "comment out all ixs (#2174)", committed 2026-04-01 — the exact day of the exploit.**
  ~1,888 lines changed, almost entirely in `lib.rs` (an Anchor program's instruction-entrypoint file
  — the same role `programs/viperx_agent_registry/.../lib.rs`'s `#[program] mod` plays in this repo).
  Consistent with an emergency kill-switch: disable every instruction while actively being drained.
- **`programs/drift/src/instructions/user.rs` — where our `SpotMarketNotFound` error originates —
  has had no commits since that day.** Three-plus months with the file that handles deposits
  untouched in the public history.
- Devnet hasn't been fully abandoned: a devnet-specific oracle fix closed as recently as 2026-06-19.
  But no open issue in the repo mentions `SpotMarketNotFound` or a devnet deposit outage — either
  it's undiscussed publicly, or being tracked in Discord instead of GitHub.

Reading between those: this looks like the incompletely-reversed state of an emergency shutdown, with
engineering attention since going mostly to the mainnet Velocity relaunch (private beta, Tether credit
line) rather than a full devnet restore — not a deliberate, in-progress migration. Either way, the
practical conclusion is the same: this is the project's own standing lesson in practice
(`docs/ROADMAP.md`'s "lessons learned") — once a blocker traces to unhealthy external infra, stop
debugging it and move on rather than keep guessing against live devnet transactions.

**What this means concretely:** `frontend/hooks/useDrift.ts`'s `depositSolCollateral` — moved into
this repo and typechecked earlier, but never runtime-tested — calls `deposit()` the same way and
would hit this same failure right now, for the same reason any other deposit does. It is not safe
to treat that hook as verified end-to-end; only its types are.

**Everything else in the delegation flow was verified independently of this bug**: `updateUserDelegate`,
`authoritySubAccountMap` + `switchActiveUser` for multi-owner delegate trading, `openPosition`/
`closePosition` signatures, and `withdraw`'s signature are all confirmed correct against the installed
SDK. The blocker is specifically "can collateral get into a devnet Drift account at all right now,"
not the delegation model this project's non-custodial design depends on.

**Before spending more time on this:** this is now squarely a devnet-infra question, not a
code question. Re-run `scripts/drift-devnet-vault-test.ts` in a few days — if the Velocity migration
is the cause, it should resolve on its own. If `deposit()` still fails identically at that point,
worth checking Drift/Velocity's own Discord or GitHub issues for devnet status before spending more
engineering time on it.

### Re-check 2026-07-18: still broken, identical failure

Re-ran `scripts/drift-devnet-vault-test.ts` against the existing funded owner keypair
(`7aS3TCCLGEAHKyMSKmnhfxuwZGa4tKGKSdJfefoRFdSe`, 5.44 SOL — plenty of headroom). Depositing 10 USDC
into market 0 failed with the exact same error as 2026-07-16:

```
Program log: Could not find spot market 0 at programs/drift/src/instructions/user.rs:694
AnchorError ... SpotMarketNotFound. Error Number: 6087.
```

Same compute units consumed (14,162), same instruction count, failed at simulation before submission
— no funds at risk, owner balance unchanged. Two days apart, byte-for-byte the same failure: this is
not a transient blip, it's a standing outage. Worth checking Drift/Velocity's Discord or GitHub issues
directly next time before re-running the script again — burning another manual test cycle on an
unhealthy external dependency has diminishing value past this point.

## Addendum 2026-07-18: self-deploying the vendored `drift-protocol-v2` clone — evaluated and rejected

With Drift's own devnet deployment confirmed still broken (two re-checks, both identical
failures), self-deploying the vendored `backend/execution-runtime/drift-protocol-v2/` clone under
our own program ID was considered as a way to stop depending on Drift's shared devnet infra
entirely. Scoped as a local-validator checkpoint first, before ever touching a real deploy.

**Rejected for two independent reasons, not one:**

1. **Security/reputation, not just technical risk.** Drift *mainnet* was exploited for ~$285M
   (2026-04-01) and relaunched as Velocity DEX. The root cause was never confirmed in this
   project's research — it's unknown whether it was a program-logic bug, an oracle manipulation, or
   a key-custody failure. Self-deploying this vendored snapshot means running code with a known
   catastrophic-loss history, frozen and unpatched by us, with none of Drift's own team's ongoing
   monitoring. Devnet funds are worthless today, so there's no immediate financial exposure, but
   for a **grant-application demo** specifically, building the non-custodial trading pitch on a
   fork of the exact protocol that just lost $285M is a real credibility problem independent of
   whether the devnet code is technically safe.
2. **The toolchain confirmed this snapshot isn't being kept buildable.** The first build attempt
   alone hit two unrelated, real failures: Anchor `0.29.0` (the version this vendored program
   requires — see below) calls a `cargo build-bpf` command that no longer exists in a modern Solana
   CLI (fixed with `--arch sbf`), then a transitive dependency (`ahash v0.8.6`) failed to compile
   with `error[E0635]: unknown feature 'stdsimd'` — a Rust nightly feature-gate name that's since
   been renamed/removed upstream, surfaced by Solana's own bundled compiler being newer than what
   this ~1.5–2 year old dependency graph was locked against. The likely next fix would have been
   installing a second, older Solana CLI release just for this workspace — more toolchain
   archaeology, with no guarantee a third incompatibility wasn't waiting behind it.

**What this confirms, concretely, for anyone tempted to revisit this:**
- `avm install 0.29.0` is required to build `drift-protocol-v2/` at all (this project's own program
  stays on Anchor `0.31.1` — see `Anchor.toml` — do not leave `avm` switched to `0.29.0` globally;
  switch back after any work in the vendored directory).
- `anchor build --arch sbf -- --features anchor-test` is needed, not plain `anchor build`.
- `Anchor.toml`'s `[programs.localnet]` IDs (`dRiftyHA...`, `FsJ3A3...`, `V4v1mQ...`) don't match a
  fresh build's auto-generated keypairs, and the vendored repo ships no keypairs — `pyth`'s source
  even has two different `declare_id!()` values gated by a `mainnet-beta` feature flag, only one of
  which matches `Anchor.toml`. A real self-deploy would need `declare_id!()` edits across `drift`,
  `pyth`, and `token_faucet`, which was never reached because the build never finished.
- The init sequence itself (untested, but scoped from `tests/admin.ts` and
  `tests/testHelpers.ts`'s `mockOracle`/`createPriceFeed`): deploy `drift` + `pyth` → `driftClient
  .initialize(usdcMint, true)` → `initializeQuoteSpotMarket` → `mockOracle()` (CPIs into the
  self-deployed `pyth` program to create a controllable price account) → `driftClient
  .initializePerpMarket(...)`. This part looked genuinely workable — it's the toolchain and the
  security/reputation questions that killed this path, not the market-initialization design.

**Conclusion: stay blocked on Drift devnet recovering, or fall back to something not built on
Drift's own code, rather than self-hosting a fork of a recently-exploited protocol.** See
`NEXT_STEPS.md` for what that leaves as live options.

## Addendum 2026-07-23: migrated from Drift (`@drift-labs/sdk`) to Velocity (`@velocity-exchange/sdk`)

The `deposit()` outage documented above was never fixed on Drift's own shared devnet deployment —
it was resolved by migrating to a different, working deployment, not by Drift patching the old one.

**How this was found:** Drift rebranded to **Velocity DEX** on 2026-07-01, part of its planned
relaunch after the 2026-04-01 mainnet exploit (see the top-level Conclusion above — this was
already known and explicitly called "a Phase 5 problem, doesn't affect devnet work" at the time).
That assumption turned out to be half right: the rebrand doesn't affect *mainnet* devnet work, but
Velocity also ships a **new, separate devnet deployment** under `@velocity-exchange/sdk`, and
that new deployment is not affected by the old one's `SpotMarketNotFound` bug. This was verified,
not assumed, by applying the same four-check process this document's "What was checked" section
already prescribes:

1. **Docs** — `docs.velocity.exchange` is a real, indexed site with a full developer section
   (SDK setup, deposits/withdrawals, users, orders, PnL/risk, market-maker and keeper-bot guides).
   It states explicitly: *"on-chain state does not carry over from Drift Protocol v2"* — i.e.
   Velocity's devnet is not a continuation of Drift's old devnet under a new name, it's a distinct
   deployment. This directly explains why the old `SpotMarketNotFound` bug never affected it: it's
   a different program's state entirely.
2. **SDK** — `@velocity-exchange/sdk` on npm: 18 published versions from 2026-05-18 to
   2026-07-22 (the day before this migration), confirmed via the npm registry API directly
   (`registry.npmjs.org`), not just the package's own claims.
3. **Chain** — a standalone test script (same shape as `drift-devnet-vault-test.ts`, run first in
   an isolated scratch project before touching this repo) produced real, confirmed on-chain
   transactions: a mint-dUSDT-via-faucet + deposit (`3ypqXUC...z9iM`), a delegation grant
   (`3xZ5qMh...bWdmT`), a delegated open (`3jk1Ls1...iTPFUmTc`), a delegated close
   (`2tXAF1d...b1qVr`), and a delegate-attempted withdrawal that was correctly rejected. Re-run a
   second time from inside the actual repo after migrating the code, with identical results
   (deposit skipped as already-present, open `3auuT9T...vyLvk`, close `2VY68Db...FBrR`, withdrawal
   rejected) — confirming the migrated `drivers/velocityDriver.ts` code path, not just the
   standalone test harness, works against real devnet.
4. **Load** — `VelocityClient.subscribe()` succeeds and spot market 0 (`dUSDT`) loads with the
   correct mint on the first attempt, no retries needed.

All four passed, unlike Flash Trade or Zeta. This is a genuine fix, not a rebrand-shaped guess.

**Concrete differences from the old Drift integration**, all confirmed by installing the SDK and
reading its actual `.d.ts` files rather than trusting documentation summaries alone:

- New program id: `vELoC1audYbSYVRXn1vPaV8Axoa9oU6BYmNGZZBDZ1P` (same on devnet and
  mainnet-beta), replacing Drift's `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`.
- New devnet collateral: spot market 0 is `dUSDT` (mint
  `GqmEqYsy8EyvofDpmtFxK8zhYrgWgNokAtYoduQdL7v6`), not USDC — minted via a devnet-only
  `TokenFaucet` at program `V4v1mQiAdLz4qwckEb45WqHYceYizoib39cDBHSWfaB` (this faucet program id
  is inherited unchanged from the original Drift fork). Spot market 1 (wrapped SOL) is unchanged.
  `initializeUserAccountForDevnet()` bundles mint + account-init + deposit into one convenience
  call specifically for this flow.
- The API surface is otherwise almost identical — `VelocityClient` keeps the same method names as
  `DriftClient` (`subscribe`, `deposit`, `initializeUserAccount`, `updateUserDelegate`,
  `switchActiveUser`, `openPosition`, `closePosition`, `withdraw`, `getOracleDataForPerpMarket`,
  `getSpotMarketAccount`, `getPerpMarketAccount`), which is why the actual code migration was a
  mechanical port rather than a rewrite.
- One real behavioral difference, not just a rename: the new SDK throws
  `"Can only pass one of authoritySubaccountMap or includeDelegates"` if both are passed to the
  constructor together — the old Drift SDK silently allowed both. Fixed by passing only
  `authoritySubAccountMap`, since the specific (authority, subAccountId) pairs are always known
  ahead of time in this project's driver.
- One timing quirk found and fixed during testing: calling `closePosition` immediately after
  `openPosition` in a fast sequential script can read a stale (zero) position size from the
  polling `BulkAccountLoader`'s local cache and get rejected on-chain (`OrderAmountTooSmall`).
  Fixed with a `forceGetUserAccount()` call before `closePosition` — see `CLAUDE.md`'s Gotchas.
- Both `backend/execution-runtime` and `frontend` needed the same nested-`@solana/web3.js`
  override trick this document's Drift integration already required (see `CLAUDE.md`), just
  re-pinned to versions the new SDK bundles (`1.98.0` backend, `1.98.4` frontend, both confirmed
  zero-nested-copies after install).

**What migrated:** `backend/execution-runtime/src/drivers/velocityDriver.ts` (already named
"Velocity" before this migration, but built against `@drift-labs/sdk` internally — now actually
built against `@velocity-exchange/sdk`), `backend/execution-runtime/scripts/velocity-devnet-vault-test.ts`
(new, supersedes `drift-devnet-vault-test.ts`), `frontend/hooks/useVelocity.ts` (renamed from
`useDrift.ts`, along with `lib/velocity.ts` and `types/velocity.ts`). Both packages' `package.json`
now depend on `@velocity-exchange/sdk` instead of `@drift-labs/sdk`. `backend/execution-runtime`
typechecks and builds clean (`src/**`); `frontend` typechecks and builds clean (`next build`
succeeds). Neither `runner.ts`'s live tick loop nor `useVelocity.ts` in an actual browser session
has been run yet — see `NEXT_STEPS.md`.

**What didn't migrate:** the three pre-existing, uncommitted Drift debug scripts in
`backend/execution-runtime/scripts/` (`drift-devnet-vault-test.ts`, `inspect-drift.ts`,
`test-swap-deposit.ts`) were someone else's in-progress diagnostic work investigating the
now-superseded `SpotMarketNotFound` bug — left untouched at first rather than rewritten or
deleted without asking, then deleted the same day once confirmed no longer needed.
`npm run build` is clean.

## The lesson

Zeta, Flash, and (initially) Drift's devnet outage are the same mistake in different clothes:
**trusting a capability claim without checking the layer underneath it.** Zeta's delegation API
exists but the venue is dead. Flash's venue is alive but the delegation doesn't exist. Drift's
devnet looked alive on 2026-07-15 but its `deposit()` path was actually broken — confirming one
layer (subscribe, load markets) told us nothing about another (a specific instruction actually
executing on-chain). The Velocity migration above is the positive case of the same discipline:
before adopting it, it went through the identical four-check process, this time confirming success
with real transaction signatures instead of assuming a rebrand meant "same thing, new name."

Note that this repo's own `record_trade` has the identical bug class — its context requires
`owner: Signer`, so the backend cannot call it, despite every doc comment saying the backend does.
See `CLAUDE.md`.
