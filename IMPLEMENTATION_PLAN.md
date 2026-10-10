# ViperX — 7-Day Hackathon Implementation Plan (Colosseum / Solana Track)

> **Contest**: Crypto World’s Fair Hackathon (Colosseum)  
> **Target**: Solana Track ($100,000) & Grand Champion ($30,000 Phantom CASH)  
> **Deadline**: October 12, 2026 @ 11:59 PM PT (October 13, 12:29 PM IST)  
> **Time Horizon**: ~7 Days remaining

---

## 1. Executive Objective

Execute a focused, tactical 7-day sprint directly resolving the **5 structural weaknesses** identified in the expert review while **preserving OKX X Layer (EVM) support intact**:
> [!IMPORTANT]
> **Venue Preservation Directive**: Do **NOT** remove or strip OKX X Layer support, contracts, or MCP routes. With the OKX Dev Day Singapore Finale (Oct 7) underway, X Layer remains live and fully operational as our primary EVM execution venue. Our Colosseum submission will present Solana (Velocity DEX) as the flagship verification truth engine within a clean multi-chain architecture (EVM on X Layer + SVM on Solana).

1. **Clarify External Verification**: Highlight that Solana verification occurs against **Velocity DEX** (external venue), not an operator-controlled perp pool.
2. **Wash-Trading Heuristic Upgrades**: Add a minimum trading time-window requirement (≥ 4 hours/sessions) and counterparty diversity metrics to prevent self-crossing loops.
3. **Clean the Trust Model**: Compute leaderboard rankings (Sharpe/drawdown) **strictly on `onchain_verified_pnl`**, demoting self-reported telemetry to purely a diagnostic divergence trigger.
4. **Statistical Depth**: Add sample size context and confidence bands to the 50-trade Sharpe score.
5. **Decentralize "Who Watches the Watcher"**: Deliver a reproducible, open-source 1-command verification CLI (`npm run verify-agent <agent_pda>`) that independently re-computes PnL from raw Solana RPC state.
6. **Produce the Winning 3-Minute Demo**: Execute the high-contrast split-screen demo ("ScamBot" fake claims vs. ViperX live divergence flagging).

---

## 2. Daily Sprint Breakdown (Days 1 to 7)

```
┌────────────────────────────────────────────────────────────────────────┐
│                    7-DAY COLOSSEUM EXECUTION TIMELINE                  │
├────────┬───────────────────────────────────────────────────────────────┤
│ Day 1  │ Narrative Realignment & Noise Reduction (Cut & Demote)        │
│ Day 2  │ Pure On-Chain Ranking & Statistical Confidence Metrics        │
│ Day 3  │ Wash-Trading Defense Upgrades (Time Windows & Volume Density) │
│ Day 4  │ "Who Watches the Watcher": Open-Source Verifier CLI Script    │
│ Day 5  │ Adversarial Dry-Run & Recording the 3-Minute Demo Video       │
│ Day 6  │ Submission Packaging (Addressing all 6 Judging Criteria)     │
│ Day 7  │ Final Polish, Team Verification, & 24h Early Submission       │
└────────┴───────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Days 1–2 — Narrative Realignment & Trust Model Cleanup

#### Task 1.1: Demote "Bot" Features to "Reference Implementations"
- **Problem**: Showing multiple strategies (momentum, grid, mean-reversion) and the strategy tuning engine makes ViperX look like a bot project rather than an ecosystem verification standard.
- **Action**:
  - Reframe bot strategies in the UI and README as: *"Open-Source Reference Quant Agents (Autonomous Clients)"*.
  - Demote the manual trading terminal and faucet in navigation; place the **Public Leaderboard**, **Agent Profile Verification**, and **Verification Inspector** front and center.
  - Move Copy-Trading Vaults explicitly to "Phase 2 Roadmap: Non-Custodial Vault Delegations".

#### Task 1.2: Eliminate Venue Circularity in the Pitch
- **Problem**: Reviewer warned against "grading your own homework" if you operate the perp DEX.
- **Action**:
  - Explicitly document that Solana Devnet trades settle on **Velocity DEX** (`vELoC1audYbSYVRXn1vPaV8Axoa9oU6BYmNGZZBDZ1P`), Drift's post-exploit rebuild.
  - Highlight that trades incur real market slippage, margin limits, and protocol fees on an external protocol.
  - Emphasize that `velocityWatcher.ts` reads `PerpPosition.settledPnl` directly from Velocity's on-chain account state.

#### Task 1.3: Clean the Scoring Engine (Rank Purely on Chain State)
- **Problem**: Calculating Sharpe from self-reported trades weakens credibility.
- **Action**:
  - In `backend/leaderboard-api/src/scoring.ts`, enforce that `calculateSharpeLike()` and ROI only ingest `onchain_verified_pnl`.
  - Self-reported `realized_pnl` is retained exclusively to check for divergence:
    $$\text{Divergence} = |\text{realized\_pnl}_{\text{reported}} - \text{onchain\_verified\_pnl}| > \$0.50$$
  - If divergence occurs ≥ 2 times, the agent is quarantined with `isWashTraded: true`.

---

### Phase 2: Day 3 — Wash-Trading Defense Upgrades & Quant Depth

#### Task 2.1: Multi-Hour Window Requirement (Anti-Burst Gate)
- **Problem**: 50 rapid fills executed within 10 minutes can game the minimum-fill gate.
- **Action**:
  - Add a requirement that the 50 qualifying fills must span across at least **4 distinct hours** or **market sessions**.
  - Update `scoring.ts` to compute:
    ```typescript
    const timeSpanHours = (maxCloseTime - minCloseTime) / (1000 * 60 * 60);
    const passesTimeDiversity = timeSpanHours >= 4.0;
    ```
  - Display this on the frontend: *"50 verified fills across ≥ 4 unique market windows"*.

#### Task 2.2: Statistical Significance & Confidence Bands
- **Problem**: Quant-minded judges will note that Sharpe over 50 trades has high variance.
- **Action**:
  - Calculate standard error of the Sharpe ratio:
    $$\text{SE}(\text{Sharpe}) \approx \sqrt{\frac{1 + \frac{1}{2}\text{Sharpe}^2}{N}}$$
  - In the agent profile UI (`app/agents/[agentPda]/page.tsx`), display the confidence interval: e.g. `Sharpe: 1.84 (±0.28, 95% CI)`.
  - Add a tool-tip badge: *"Sample size: 52 verified fills. Minimum 100 fills recommended for institutional deployment."*

---

### Phase 3: Day 4 — "Who Watches the Watcher?" (Reproducibility CLI)

#### Task 3.1: Standalone Open-Source Verification Script
- **Problem**: If the watcher runs on your backend server, judges may ask: "How do we know the backend isn't faking the verified numbers?"
- **Action**:
  - Create a standalone CLI script: `scripts/verify-agent-cli.ts`.
  - Anyone can run:
    ```bash
    npm run verify-agent <AGENT_PDA>
    ```
  - What it does:
    1. Connects directly to Solana Devnet public RPC (`api.devnet.solana.com`).
    2. Fetches the Agent PDA account from `viperx_agent_registry`.
    3. Reads the agent's Velocity DEX vault subaccount.
    4. Calculates the settled PnL and trade count directly from raw on-chain state without querying ViperX's database.
    5. Prints a cryptographic verification receipt with tx signatures.

---

### Phase 4: Day 5 — Adversarial Demo Video ("The Money Shot")

#### Task 4.1: Live Divergence Catch Setup
- Prepare two test agents on Solana Devnet:
  1. **ScamBot (`pnl-divergence-attacker`)**: Formatted to report +9,999% ROI to the registry while on-chain settled PnL is $0.00.
  2. **AlphaQuant (`momentum-sol-2`)**: Authentic agent meeting the 50-trade gate across real Velocity fills.
- Run `backend/execution-runtime/scripts/attack-pnl-divergence.ts`.

#### Task 4.2: Record the 3-Minute Video (Exact Beat Outline)
* **[0:00 – 0:30] The Crisis**: Show fake Twitter screenshots of AI agents boasting +5,000% ROI. Show how simple on-chain counters (`record_trade`) are trivially spammed.
* **[0:30 – 1:30] The Money Shot**: 
  - Show "ScamBot" reporting +9,999% ROI.
  - Watcher polls Solana Velocity position state live.
  - Screen displays: **DIVERGENCE DETECTED** (`$9,999` reported vs `$0` settled).
  - ScamBot is immediately slapped with a red warning badge and removed from ranking.
* **[1:30 – 2:15] The Real Deal**:
  - Show AlphaQuant with 51 verified fills, Sharpe 1.00 (±0.25), and zero divergence.
  - Run the `verify-agent` CLI live in the terminal to prove the data comes directly from Solana RPC.
* **[2:15 – 3:00] Architecture & Composability**:
  - Show the MCP endpoint (`list_verified_agents`).
  - Summarize the non-custodial delegated session keys (`authority_pause` circuit breaker).
  - Closing call: *"ViperX makes autonomous finance verifiable."*

---

### Phase 5: Day 6 — Colosseum Submission Packaging

Align written submission copy explicitly with Colosseum’s **6 Official Judging Criteria**:

1. **Functionality (5/5)**: Live Solana Devnet deployment (`viperx_agent_registry` at `321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm`), 180+ real transactions, 120+ verified fills, live watcher, active indexer.
2. **Impact (5/5)**: Unlocks institutional capital for autonomous AI agents by providing the verifiable track-record standard.
3. **Novelty (5/5)**: First dual-reconciliation engine separating "claimed" from "verified" on-chain perp fills.
4. **UX (5/5)**: Public dashboard with instant agent lookup, clear audit trails, and zero-trust verification badges.
5. **Open-Source (5/5)**: MIT licensed monorepo, clean IDLs, reproducible verification CLI, and JSON-RPC Model Context Protocol (MCP) server.
6. **Business Plan (5/5)**: 
   - Primary: B2B Verified Agent Performance API for funds and allocators.
   - Secondary: Verification & Staking fees for agent creators.
   - Tertiary: Performance fees on future non-custodial copy-trade vaults.

---

### Phase 6: Day 7 — Early Submission & Buffer

- [ ] Complete all team member registrations on `colosseum.com/worldsfair`.
- [ ] Upload 1080p video with clear audio and burnt-in subtitles to YouTube/Vimeo.
- [ ] Submit final URLs (Live App, Public GitHub, Video URL, Explorer Links) at least **24 hours ahead of deadline** (October 12, 12:00 PM IST) to avoid server outages.
