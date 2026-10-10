# Crypto World’s Fair Hackathon (Colosseum) — Master Strategy & Rules

> **Source of Truth**: Official Hackathon Rules issued by Colosseum Org LLC (`colosseum.com/worldsfair`)  
> **Contest Period**: September 14, 2026, 6:00 AM PT – October 12, 2026, 11:59 PM PT  
> **Submission Deadline (Local Time)**: **October 13, 2026, 12:29 PM IST**  
> **Time Remaining**: ~23 Days (~573 Hours) as of September 19, 2026  
> **Target Project**: **ViperX** — The Verifiable On-Chain Performance & Arena Layer for Autonomous AI Trading Agents  

---

## 1. Hackathon Overview & Key Operational Rules

* **Host / Administrator**: Colosseum Org LLC (`hello@colosseum.com` / `hackathon@colosseum.com`)
* **Portal / Platform**: `colosseum.com/worldsfair`
* **Winners Announcement**: On or about **December 5, 2026**
* **Governing Law / Dispute**: Arbitration under ICC Rules, State of Florida, USA

### Hard Constraints & Disqualifiers
1. **Team & Submission Limits (Section 7)**:
   - An entrant may **only be a member of one (1) Team**.
   - A team may **only submit one (1) Project Submission**.
2. **Registration Requirement (Section 6)**:
   - Every individual team member must register on `colosseum.com` before **October 12, 2026, 11:59 PM PT**. The registration form will be disabled after this time.
   - The Team Leader must upload the Project Submission before the deadline.
3. **Language & Content Guidelines (Section 12)**:
   - All content, documentation, and videos must be in **English**.
   - Submissions must not contain malicious software, violate third-party IP, or violate video platform terms.
4. **Open-Source Requirement (Section 8e)**:
   - Projects must be open-source and demonstrate composability with crypto ecosystem primitives.
5. **Intellectual Property (Section 9 & 10)**:
   - **Entrants retain 100% intellectual property rights** to their code and submissions.
   - Colosseum retains rights to "Creative Materials" (promotional/marketing media created around the hackathon).
6. **Eligibility Exclusions (Section 3b)**:
   - Excluded jurisdictions: Afghanistan, Belarus, Cuba, Iran, North Korea, Russia, Somalia, Syria, Crimea/Donetsk/Luhansk/Zaporizhzhia/Kherson regions of Ukraine, Venezuela, and Yemen.
   - Any OFAC/sanctioned persons or entities are ineligible. Must be 18+ or age of majority.

---

## 2. Prize Pools & Track Allocations (Section 14)

Prizes are stated before taxes and paid in cash / stablecoin directly to the Team Leader’s designated wallet:

| Award / Track | Total Allocation | Distribution Details |
| :--- | :--- | :--- |
| **Grand Champion** | **$30,000** | Paid in **Phantom CASH** stablecoin |
| **Standout Teams** | **$300,000** | **$15,000 CASH each** to the next 20 standout teams |
| **Public Goods Award** | **$5,000** | CASH |
| **University Award** | **$5,000** | CASH |
| **Solana Track** | **$100,000** | Awarded across 10 best products integrating with **Solana** |
| **Hyperliquid Track** | **$100,000** | Awarded across 10 best products integrating with **Hypercore / HyperEVM** |
| **Tempo Track** | **$100,000** | Awarded across 10 best products integrating with **Tempo** |
| **Zcash Track** | **$100,000** | Awarded across 10 best products integrating with **Zcash** blockchain/asset |
| **Base Track** | **$25,000** | Awarded across 5 best products integrating with **Base** |
| **Arbitrum Track** | **$25,000** | Awarded across 5 best products integrating with **Arbitrum** |
| **Ethereum L1 Track** | **$25,000** | Awarded across 5 best products integrating with **Ethereum L1** |
| **Robinhood Chain Track**| **$25,000** | Awarded across 5 best products integrating with **Robinhood Chain** |

---

## 3. Official Judging Criteria (Section 8)

Every submission is evaluated against six specific criteria:

1. **Functionality**: How well does this Project Submission work? What is the quality of the code?
2. **Potential Impact**: How big is the total addressable market (TAM) for this Project Submission? What will be the impact on the broader crypto ecosystem?
3. **Novelty**: How unique is this Project Submission’s concept?
4. **UX**: How well does this Project Submission utilize blockchain to create great UX for downstream users?
5. **Open-source**: Is this Project Submission open-source? How well does the Project Submission compose with other primitives in the crypto ecosystem?
6. **Business Plan**: Is there a viable business that can be built in the future around this Submission? How adept is the team building the product to execute on the vision?

---

## 4. ViperX Strategic Positioning & Track Fit

### Primary Target: **Solana Track ($100k) + Grand Champion ($30k Phantom CASH)**

* **The Organizer Advantage**: Colosseum is the premier Solana accelerator and hackathon organization. Grand Champion is paid in Phantom CASH. The judges know Solana deeply.
* **Existing Protocol Assets**:
  * Anchor Program: `viperx_agent_registry` (`321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm` on Solana Devnet)
  * Perpetual Program: `viperx_perpetuals` (`6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED` on Solana Devnet)
  * On-chain position settled PnL reconciliation via independent Solana watcher
* **High-Value Extension**: ViperX already has cross-chain readiness (Base Sepolia deployed contracts). Highlighting Solana verification as the core truth engine with multi-chain agent execution positions ViperX as an ecosystem-scale primitive.

---

## 5. Scoring Alignment: How ViperX Hits 5/5 on Every Criteria

### A. Functionality & Code Quality
* **Real On-Chain Logic**: Not a mocked frontend. Real Anchor programs on Solana devnet (`programs/viperx`) + Solidity contracts on Base Sepolia (`ViperVault`, `PositionRouter`, `PythPriceAdapter`).
* **Active Reconciler**: `pnl-indexer` with `velocityWatcher` polling live on-chain settled states.
* **Autonomous Execution**: Keeper bot executing automated order flows and round-trip detection.

### B. Potential Impact & TAM
* **The Problem**: Hundreds of autonomous AI trading agents are launching, claiming astronomical returns based on unverifiable Twitter screenshots or self-reported telemetry.
* **The Impact**: ViperX is the verifiable track record and capital routing layer for autonomous agents. Just as Chainlink secured external data and DeFiLlama standardized TVL, ViperX standardizes **Verifiable Agent Performance**.

### C. Novelty (The Claimed vs. Verified Distinction)
* **The Flaw in Competitors**: Other agent registries just increment an on-chain counter (`record_trade`), which can be trivially spammed by the agent’s own key without placing real orders.
* **ViperX Innovation**:
  * **Gate 1**: Qualification requires 50 settled closes independently confirmed against on-chain position state (`PerpPosition.settledPnl`).
  * **Gate 2**: Anti-gaming heuristics including minimum trade size ($5), round-trip latency checks (sub-10s detector), and PnL divergence thresholds.

### D. UX
* **Downstream Users**: Retail investors can browse verified leaderboards without reading raw blockchain transactions or relying on Twitter hype.
* **One-Click Vaults**: Copy-trading vaults allow users to delegate capital directly to verified high-performing agents.
* **Arena Duels**: Gamified head-to-head match-ups between autonomous agents with live PnL telemetry.

### E. Open-Source & Composability
* Complete monorepo open-sourced with clean documentation.
* Composable Anchor IDLs allow any Solana perp protocol (Drift, Velocity, Flash, Jupiter Perps) to plug into the indexing engine.

### F. Business Plan
* **Copy-Trading Performance Fees**: 10%–20% performance fee on user profits (shared between agent creators and ViperX protocol treasury).
* **Agent Verification & Listing Fees**: Staking requirements and verification fees for institutional trading funds.
* **B2B Data API**: High-frequency verified performance feeds for algorithmic allocators and DAO treasuries.

---

## 6. The 3-Minute Demo Script ("The Money Shot")

A winning Colosseum video follows a strict, high-contrast narrative:

1. **0:00 – 0:30 (The Hook & The Crisis)**:
   * Show the explosion of AI trading agents. Show fake screenshots on Twitter claiming +5,000% ROI.
   * Reveal why standard on-chain counters fail: an agent can spam its own registry without placing a single trade.
2. **0:30 – 1:30 (The Money Shot — Live Divergence Catch)**:
   * Show a malicious agent (*"ScamBot"*) reporting +9,999% ROI to the registry.
   * Show the ViperX `pnl-indexer` reading the on-chain settled position on Solana.
   * **The Moment**: Divergence detected (`Settled PnL = $0.00` vs `Reported = $9,999`). The agent is immediately flagged and excluded from the leaderboard live on screen.
3. **1:30 – 2:15 (The Real Deal — Verified Agent & Arena)**:
   * Show an authentic agent meeting the 50-trade independent gate.
   * View the agent profile: verifiable on-chain trade hashes, max drawdown, Sharpe ratio, and verified PnL.
   * Live demonstration of an Arena duel between two verified agents.
4. **2:15 – 3:00 (Downstream UX & Vision)**:
   * Walkthrough of a user depositing into the Copy-Trade Vault.
   * Architecture overview: Solana Anchor program + decentralized reconciliation watcher.
   * Closing vision: The standard verification protocol for the future of autonomous finance.

---

## 7. Execution Timeline (23 Days Remaining)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DEADLINE: October 12, 2026 · 11:59 PM PT (Oct 13, 12:29 PM IST)         │
└─────────────────────────────────────────────────────────────────────────┘

[Sept 19 – Sept 25] Milestone 1: Core Flow Hardening
  ├── Verify end-to-end demo flow on Solana Devnet
  ├── Test reconciliation engine edge cases (fake PnL detection)
  ├── Freeze new feature additions; polish UI components

[Sept 26 – Oct 3] Milestone 2: Adversarial Audit & Polish
  ├── Run full UX audit (zero console errors, responsive screens)
  ├── Ensure public contract addresses and IDLs are clearly linked in README
  ├── Clean commit history with descriptive semantic commits

[Oct 4 – Oct 8] Milestone 3: Demo Video & Collateral Creation
  ├── Record high-resolution screen demo matching the 3-minute script
  ├── Record crisp voiceover and add burnt-in subtitles
  ├── Prepare presentation deck / visual diagrams of the verification engine

[Oct 9 – Oct 11] Milestone 4: Early Submission & Verification
  ├── Register all team members on colosseum.com/worldsfair
  ├── Submit project profile, video URL, GitHub link, and live site link
  └── Verify submission receipt 24h+ ahead of deadline rush
```

---

## 8. Idea & Deliverables Checklist

- [ ] **Colosseum Team Registration**: All team members registered on `colosseum.com`.
- [ ] **Live App URL**: Verified running without console errors.
- [ ] **GitHub Repository**: Public, clean README with architecture diagram, local setup, and contract addresses.
- [ ] **3-Minute Demo Video**: Uploaded to YouTube / Vimeo (unlisted/public) in 1080p+ with subtitles.
- [ ] **Contract Verification**: Solana Explorer links to devnet programs (`viperx_agent_registry`, `viperx_perpetuals`).
- [ ] **Submission Text**: Written copy addressing all 6 judging criteria concisely.
