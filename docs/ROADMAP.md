# Solana AI Agents Hub — Build Roadmap (Devnet → Grant → Mainnet)

> **Venue status — verified 2026-07-15.** Everything below still targets Drift, and that
> remains correct **for devnet**. Read this box before acting on any other roadmap draft.
>
> **Drift mainnet was exploited** (~$285M, 2026-04-01, Lazarus-linked) and has relaunched as
> **Velocity DEX** (private beta, Tether credit line, USDT replacing USDC). That is a real and
> serious event — but it is a **Phase 5 (mainnet) problem, not a Phase 1–4 problem.**
>
> **Drift devnet is alive and fully usable right now.** Verified directly, not from docs:
>
> | Check | Result |
> |---|---|
> | `DriftClient.subscribe()` on devnet | succeeds |
> | Perp markets loaded | **30** (SOL-, BTC-, ETH-, XRP-PERP …) |
> | SOL-PERP market status | `active`, live oracle (~$80) |
> | `updateUserDelegate()` | present — the trade-but-not-withdraw primitive |
> | `@drift-labs/sdk` | 2.163.0-beta.13, published 2026-05-11 (**after** the exploit) |
> | `@drift-labs/vaults-sdk` | 0.11.1 — manager/follower fee-split for Phase 3 |
>
> **Do not pivot to Zeta Markets.** A separate roadmap draft proposes this. Zeta's own docs say
> verbatim: *"Zeta Markets has ceased operating as of May 2025."* It pivoted to Bullet. Verified:
> `Exchange.load(DEVNET)` fails with `Invalid account discriminator`; the devnet USDC faucet
> returns HTTP 503; the devnet program has zero transactions; the SDK has not shipped since
> 2025-09-17. `devnet.zeta.markets` still renders a live SOL-PERP price **because Pyth's oracles
> are live** — the frontend is a zombie reading real oracles in front of a dead exchange. That is
> what makes this trap convincing. Zeta's `editDelegatedPubkey` *does* exist in the SDK exactly as
> advertised; the API was never the problem. **"The API exists" and "the venue runs" are different
> questions, and only the second one matters.**
>
> Phase 3 note: staying on Drift means the manager/follower fee-splitting stays a *venue* feature
> (`managementFee`, `profitShare`). Pivoting to Zeta would have forced you to build that yourself —
> a large, avoidable scope addition.
>
> **Standing rule:** before adopting any venue, run these four checks in order — (1) does the
> project's own *documentation* say it is alive (marketing pages lie by omission), (2) does the SDK
> still ship, (3) does the devnet program have *successful* recent transactions, (4) does the
> client actually load the exchange. Zeta passes zero of the four. Cost of the check: minutes.
>
> **Update — 2026-07-16, one day after the above: `DriftClient.deposit()` turned out to be broken
> for every market on this devnet deployment.** "Subscribe works" is not "deposit works" — read
> `docs/VENUE-EVALUATION.md`'s addendum before assuming devnet is usable end to end. This doesn't
> change the conclusion above (still Drift, still not Zeta), it just means the remaining work is
> blocked on Drift's own devnet recovering, not something to build around. See `CLAUDE.md` and
> `NEXT_STEPS.md` for current status.
>
> **Also stale below**: references to `solana-agent-kit` as the Drift integration path. It was
> removed from `execution-runtime` — its Drift plugin hardcodes mainnet (now Velocity DEX, a
> different program), so it was never viable for devnet. `execution-runtime` builds directly
> against `@velocity-exchange/sdk` (see next update). Don't re-add `solana-agent-kit`.
>
> **Update — 2026-07-23: migrated off Drift devnet to Velocity DEX's own devnet deployment.**
> The `deposit()` outage from the 2026-07-16 update above was never fixed upstream. Drift's
> 2026-07-01 rebrand to **Velocity DEX** turned out to ship a *separate* devnet deployment
> (`docs.velocity.exchange` confirms on-chain state doesn't carry over from Drift v2), and that
> deployment's `deposit()` works — verified with real on-chain transactions (deposit, delegated
> open, delegated close, rejected delegate withdrawal) before adopting it, the same four-check
> process this box already prescribes. `execution-runtime` and `frontend` now build against
> `@velocity-exchange/sdk` instead of `@drift-labs/sdk` — every `@drift-labs/sdk`/`DriftClient`
> reference in the sections below is accordingly stale; read `CLAUDE.md`'s Execution venue
> section and `docs/VENUE-EVALUATION.md`'s migration addendum for what actually changed (new
> program id, `dUSDT` devnet collateral instead of USDC, near-identical API surface). This is
> still "stay on a Drift-lineage venue, don't pivot to Zeta or build your own perp engine" — the
> underlying strategic call from 2026-07-15 hasn't changed, only which deployment of it.

## The core insight before you write any code

You don't need to build agent execution, perp trading, or even trade signing from scratch. The Solana ecosystem already has:

- **Solana Agent Kit** (`solana-agent-kit` by sendaifun) — the standard toolkit connecting AI agents to Solana protocols, with plugins for DeFi, tokens, NFTs. It already has built-in **Drift Protocol** perp trading actions (`driftPerpTrade`, delegated vault trading), so agents can open perp positions with a single function call.
- **Drift Protocol** — the leading Solana perp DEX, has a full devnet deployment, an SDK, and supports **delegated vaults** (an owner can let an agent trade a vault without holding the withdrawal keys — this is your copy-trading primitive, basically for free).
- **Turnkey / Privy** — policy-controlled key management for agent wallets (spending limits, scoped permissions, no raw private keys in your backend). This is the 2026 standard for not getting drained by a buggy agent.

This changes your build order a lot: **Phase 1 (agent hub + leaderboard) sits on top of Drift's existing perp engine.** You're not building a trading engine from scratch until Phase 2, and even then you can decide whether to fork/extend Drift-style infra or build fresh.

---

## Phase 0 — Foundation (Week 1–2)

**Goal:** Decisions locked before code.

1. **Name the project.** Do this first — it shapes your repo, domain, docs, and grant application.
2. **Pick the agent execution model:**
   - *Bring-your-own-agent*: users connect any bot via API/webhook that submits trade intents to you.
   - *Hub-provided agent framework*: users configure a strategy from templates you provide (safer, more controlled, better for a v1 demo).
   - Recommendation: start with the hub-provided framework for your MVP — it's much easier to keep the leaderboard honest and the demo controlled.
3. **Pick the custody model:** Drift's delegated vaults are the cleanest fit — the agent gets trading authority over a vault, users deposit/withdraw themselves, you never touch user funds directly. This also gives you a clean regulatory story for the grant application ("we are non-custodial by design").
4. **Tech stack decision:**
   - Programs: **Anchor (Rust)** for any on-chain state you own (agent registry, competition/arena logic, leaderboard anchoring, subscription escrow)
   - Agent/backend: **TypeScript** + `solana-agent-kit` + `@drift-labs/sdk` (fastest path, best ecosystem support)
   - Indexing/PNL tracking: Node backend + Postgres, fed by Drift's account data / Helius webhooks or Yellowstone gRPC for real-time state
   - Frontend: Next.js + Solana wallet adapter
5. **Set up devnet infra:** local validator for dev (`solana-test-validator`), devnet RPC (get a dedicated RPC from Helius/QuickNode — shared endpoints throttle and will burn you even in testing), devnet SOL faucet, Drift devnet environment.

---

## Phase 1 — Core Infrastructure: Agent Registry + Execution (Week 3–6)

**Goal:** An agent can be created, funded (devnet), and place a real trade on Drift devnet.

1. **On-chain agent registry (Anchor program):** each agent gets a PDA storing owner, strategy metadata, creation time, status (active/paused). This is your on-chain "identity" layer — important for the grant narrative and for anti-Sybil measures later.
2. **Agent wallet + delegation setup:** each agent gets a Drift delegated vault (or a scoped Turnkey/Privy-managed key) so it can trade without holding user withdrawal rights.
3. **Agent execution runtime:** a backend service (containerized, one process per agent or a shared worker pool) that:
   - Runs the agent's strategy loop (simple rule-based to start — e.g. momentum, mean-reversion — real ML/LLM-driven strategies can come later)
   - Uses `solana-agent-kit`'s Drift plugin to submit perp orders on devnet
   - **Simulates every transaction before submitting** (standard practice — catches bugs before they burn fees or corrupt state)
   - Has a circuit breaker: max position size, max daily loss, auto-pause on anomalous behavior
4. **Trade/PNL indexer:** listens to on-chain Drift account changes for each agent's vault, computes realized/unrealized PNL and ROI, writes to Postgres. This data feed is the backbone of everything downstream (leaderboard, arena scoring, subscriber-facing stats).

**Milestone:** you can deploy an agent on devnet, watch it open/close a position on Drift, and see PNL update in your DB.

---

## Phase 2 — Leaderboard + Arena (Week 7–10)

**Goal:** Public competition mechanics that are hard to game.

1. **Leaderboard service + API:** ranks agents by ROI/PNL over selectable windows (24h/7d/30d/all-time). Compute risk-adjusted metrics too (Sharpe-like ratio, max drawdown) — pure PNL ranking gets gamed by high-leverage flukes almost immediately.
2. **Anti-gaming rules:**
   - Minimum track record (e.g. 50+ trades or 7+ days) before an agent is leaderboard-eligible
   - Position size caps relative to vault size
   - Flag/exclude wash-trading patterns (self-trading against own or affiliated accounts)
3. **Arena/competition mode:** time-boxed competitions (e.g. weekly), optional entry stake, prize pool distributed to top N agents at close. This is your viral mechanic — make results shareable (auto-generated result cards).
4. **Frontend v1:**
   - Public leaderboard page
   - Agent profile page (strategy description, PNL chart, trade history, risk metrics)
   - "Create agent" flow (pick a strategy template, fund the vault with devnet SOL/USDC)

**Milestone:** a working public demo — anyone can spin up a test agent, watch it compete, and see itself on a leaderboard. This is your grant-application demo video.

---

## Phase 3 — Marketplace: Subscribe / Copy-Trade (Week 11–14)

**Goal:** Let users follow top agents.

1. **Subscription/copy-trade contract:** when a user subscribes to an agent, their own Drift vault mirrors the agent's trades proportionally. Since Drift vaults already support a manager/follower structure with management + profit-share fees, you can lean on that primitive rather than inventing a new one.
2. **Fee logic:** management fee + performance fee (carry), matching the vault parameters Drift already exposes (`managementFee`, `profitShare`, `hurdleRate`).
3. **Notification layer:** alert subscribers on trade execution, drawdown thresholds, agent pausing, etc.

**Milestone:** full loop closed — deploy agent → compete → rank → get subscribers → subscribers copy-trade — all on devnet.

---

## Phase 4 — Hardening + Grant Application (Week 15–17, can overlap with Phase 3)

1. **Security pass:** review every agent permission scope, test with `solana-program-test` for attack vectors (front-running, reentrancy-style issues in your Anchor programs), make sure agents can never exceed vault-delegated authority.
2. **Docs + demo video:** architecture diagram, problem statement (why Solana needs this), live devnet demo, tokenomics/fee model if applicable.
3. **Grant targets to prepare for:**
   - **Solana Foundation grants**
   - **Colosseum** (Solana's hackathon/accelerator — strong fit for exactly this kind of consumer-facing DeFi + AI product)
   - **Superteam** grants/bounties (good for smaller, faster funding and community visibility pre-mainnet)
4. **Narrative:** tie directly to Solana's strengths — sub-second finality and near-zero fees are *why* agent-driven trading is viable here and painful elsewhere (an agent doing hundreds of transactions/day would cost real money in gas on most other chains). That's your ecosystem-fit story.

---

## Phase 5 — Mainnet Migration (post-funding)

1. Switch RPC/cluster config from devnet to mainnet-beta (this is usually a config change, not a rewrite, if you built cleanly).
2. Real-money custody hardening: policy-controlled keys (Turnkey/Fireblocks-style) with hard spending limits, multi-sig on any admin/treasury functions, external audit of your Anchor programs before real funds touch them.
3. Gradual rollout: whitelist/capped vault sizes initially, scale up as confidence builds.
4. Begin Phase 2 of your original vision: your own perp DEX where these agents primarily trade, once you have enough agent/user volume data from the Drift-hosted phase to justify it.

---

## Suggested week-by-week priority order

| Weeks | Focus |
|---|---|
| 1–2 | Naming, architecture decisions, devnet environment setup |
| 3–6 | Agent registry, wallet delegation, execution runtime, PNL indexer |
| 7–10 | Leaderboard, anti-gaming rules, arena mode, frontend v1 |
| 11–14 | Subscribe/copy-trade marketplace |
| 15–17 | Security pass, docs, demo, grant submission |
| Post-funding | Mainnet hardening + migration, begin Phase 2 (own perp DEX) |

---

## Key libraries/tools to start pulling in immediately

- `solana-agent-kit` + `@solana-agent-kit/plugin-defi` (Drift perp trading actions built in)
- `@drift-labs/sdk` (direct SDK access when you need finer control than the agent-kit wrapper gives you)
- Anchor framework (Rust) for your own programs
- Turnkey or Privy for agent key management
- Helius or QuickNode for dedicated devnet/mainnet RPC (don't use public shared endpoints even for devnet — they throttle)
- Yellowstone gRPC (Geyser) if you need real-time account streaming for the PNL indexer instead of polling

---

*Note: this roadmap intentionally does not touch your earlier Sui DEX concept — this is a separate, standalone project.*
