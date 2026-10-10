# Bitget AI × Crypto Hackathon S2 (Base Camp) — Strategy & Submission Blueprint

> **Event**: Bitget AI × Crypto Hackathon: Genesis Season 2 (Base Camp Hackathon S2)  
> **Official Hub**: [bitget.com/activity-hub/hackathon](https://www.bitget.com/activity-hub/hackathon)  
> **Documentation**: [bitget-ai.gitbook.io/bitgetai_hackathons2](https://bitget-ai.gitbook.io/bitgetai_hackathons2)  
> **Submission Deadline**: **October 11, 2026 (23:59 UTC+8 / 9:29 PM IST)**  
> **Judging & Voting Period**: September 22 – October 15, 2026  
> **Winners Announcement**: Mid-October 2026  
> **Total Prize Pool**: **50,000 USDT** + token credit subsidies ($30 Qwen + $30 K3)  
> **Target Project**: **ViperX** — The Verifiable On-Chain Performance & Benchmark Arena for Autonomous AI Trading Agents  

---

## 1. Why ViperX is a 10/10 Fit

Under **Track 2: Agentic Trading — Open Theme**, the official Bitget S2 developer documentation explicitly states:

> *"Possible directions include, but are not limited to, **Agent evaluation / benchmarks covering decision consistency, risk-violation rate, max drawdown, stress behavior, human-takeover rate, and incremental value over fixed-rule or Human + AI baselines**... Describe decision logic and paper-trading validation; top 1 each of 2 open slots."*

ViperX solves the single biggest bottleneck in autonomous agent trading: **The Claimed vs. Verified Dilemma**. While developers claim astronomical returns through cherry-picked backtests and simulated social posts, ViperX provides independent verification of settled fills, automated anti-gaming guardrails, and head-to-head arena benchmarking.

### Track Selection
* **Primary Track**: **🟩 Track 2 · Agentic Trading**
* **Competition Theme**: **Open Theme (Agent Evaluation & Benchmarking)**
* **Alternative/Dual Submission**: **🟧 Track 3 · AI Trading Desk (Open Theme — Portfolio & Agent Copilot)** *(Max 2 theme submissions allowed per team)*

---

## 2. Hard Eligibility Criteria & Disqualifiers Checklist

Bitget strictly enforces the following validation gates. Missing any of these renders the submission invalid:

- [ ] **Working Demo URL**: Must have an accessible live web application ([www.viperx.site](https://www.viperx.site/)).
- [ ] **Structured Project Description**: Must be answered completely in the Google Form across all 6 required sections (external README links cannot substitute).
- [ ] **Mandatory X (Twitter) Post**:
  - Must include `#BitgetHackathon` and `@Bitget_AI`.
  - Must introduce the product/agent.
  - **Must Quote-Tweet**: [https://x.com/Bitget_AI/status/2100519318824055159](https://x.com/Bitget_AI/status/2100519318824055159).
  - Post URL must be provided in the form field.
- [ ] **Event → Decision → Execution Flow**: Demonstrates how agents receive market signals, decide on orders, and execute with risk controls.
- [ ] **Paper Trading / Indexer Logs**: Logs demonstrating live on-chain settled position monitoring and reconciliation.
- [ ] **No Simple S1 Repost**: ViperX is a brand new project, fully compliant.

---

## 3. Pre-Drafted Google Form Submission Content

Use this pre-formatted draft when filling out the official [Google Form Submission](https://forms.gle/GyWZCMCPocgJdJon6):

### Form Fields Overview
* **Team Name**: `ViperX`
* **Team Lead Bitget UID**: *(Your Bitget UID - numbers only)*
* **Team Lead Email**: `riteshkumar00969@gmail.com`
* **Team Lead Contact**: *(Your Telegram Handle, e.g. @yourhandle)*
* **Member Background**: `Developer`
* **University Name**: *(Leave blank)*
* **Apply for Demo Day**: `Yes, I would like to apply`
* **How did you hear about this event?**: `Twitter / X`
* **Competition Track**: `Agentic Trading`
* **Competition Sub-theme**: `Open Theme`
* **Project Name**: `ViperX`
* **One-line Project Summary (140 chars max)**:
  `ViperX is the verifiable on-chain benchmark & arena layer for autonomous AI trading agents, ranked only on settled fills.` *(122 chars)*
* **Did this team participate in S1?**: `No`
* **Apply for Post-event Kimi K3 Token Credits (30U per team)**: `Yes`
* **Open to Playbook Review and Listing Discussion**: `Yes`

---

### Field: Submission Material Links (one link per line, labeled by type)
```text
Live Demo: https://www.viperx.site
GitHub Repo: https://github.com/ritesh59697/ViperX-main
Demo Video: https://x.com/Ritesh5969/status/2108796624856351085
On-Chain Verified Logs: https://www.viperx.site/api/leaderboard?window=all
Contract Deployments: https://github.com/ritesh59697/ViperX-main/blob/main/DEPLOYED.md
```

---

### Field: Role of the LLM in Your Project
```markdown
In ViperX, LLMs act as both autonomous traders and adversarial evaluators:

1. Autonomous Agent Execution: LLM agents parse real-time market data, technical indicators, and volatility states to autonomously execute perp position intents (long/short, size, stop-loss, take-profit).
2. Behavioral & Risk Auditing: LLMs analyze post-trade telemetry against on-chain settled fills to detect style drift, calculate qualitative risk-violation scores, and explain anomalies during extreme volatility regimes.
3. Arena Duel Commentator & Benchmarking: During head-to-head match-ups, LLMs evaluate comparative risk-adjusted performance (Sharpe, Max DD, win consistency) to provide human-readable post-duel trade analytics.
```

---

### Field: Project Description (Complete 6-Part Text)

```markdown
### 1 · Thesis & Core Hypothesis
With the rise of Agentic Trading and 7×24 continuous markets, hundreds of autonomous AI trading agents are being launched. However, the ecosystem faces a catastrophic trust crisis: nearly all agents report returns using cherry-picked Twitter screenshots, paper simulations, or self-reported off-chain counters that can be trivially faked without risking capital.

ViperX is the decentralized on-chain proof and arena benchmark layer for autonomous AI trading agents. Our core hypothesis is that capital allocators and retail traders will not delegate capital to agents without mathematically verifiable performance. ViperX introduces an independent verification engine: an agent can only enter public rankings after clearing a 50-trade independent on-chain settlement gate, backed by real-time anti-gaming heuristics (sub-10s wash-trade filters, collateral floors, and PnL divergence catches).

### 2 · Target User and Product Value
Our primary target users are:
1. Crypto & Tokenized Equity Day-Traders & Copy-Traders: Retail and semi-pro traders who want to deploy capital into automated strategies but refuse to trust opaque marketing hype. ViperX gives them a single source of truth—ranking agents exclusively on settled USDC fills.
2. AI Agent Developers & Quantitative Teams: Builders seeking institutional credibility, user distribution, and verifiable performance credentials to attract capital delegation.
3. Algorithmic Allocators & DAO Treasuries: Capital managers looking for audited, risk-adjusted performance data (rolling Sharpe, Sortino, Max Drawdown) to allocate automated liquidity.

### 3 · Validation Data & Key Metrics
- Verification Engine Gate: Enforces a strict 50 settled on-chain trade minimum before any agent qualifies for the public leaderboard.
- Anti-Wash Trading Heuristics: Disqualifies rapid round-trip transactions (<10 seconds) and enforces a minimum $5 collateral floor to prevent micro-fill volume manipulation.
- Divergence Detection: Catches 100% of discrepancies between agent-reported off-chain telemetry and independent on-chain settled state (PerpPosition.settledPnl).
- Risk-Adjusted Ranking: Evaluates agents based on rolling 30-day Sharpe Ratio, Maximum Drawdown penalties, and Win-Rate consistency, rather than nominal leverage-inflated PnL.
- Distribution Target: Onboard 30+ verified autonomous agents and achieve $100k+ in copy-vault TVL during the post-hackathon beta.

### 4 · Progress & Technology Stack
- Smart Contracts:
  - OKX X Layer Testnet (EVM): ViperVault.sol (non-custodial capital pool), PositionRouter.sol, PythPriceAdapter.sol (sub-second oracle feeds for 24/7 tokenized US stocks & crypto: NVDA, TSLA, SPY, COIN, OKB).
  - Solana Devnet (SVM): viperx_agent_registry (PDA identity engine), viperx_perpetuals (SOL-PERP DEX).
- Backend & Indexer: TypeScript/Node.js pnl-indexer running velocityWatcher to poll live on-chain settled states.
- Autonomous Execution: Automated keeper runtime triggering order execution, liquidation, and divergence flagging.
- Frontend: Next.js 16 (App Router), Wagmi, RainbowKit, Solana Wallet Adapter, Tailwind CSS, Lucide icons.
- Deployed & Live: Production interface accessible at https://www.viperx.site/.

### 5 · Deliverables
All materials are linked in the Submission Materials Link:
- Live Web Application: https://www.viperx.site/
- Monorepo & Source Code: https://github.com/ritesh59697/ViperX-main
- Contract Documentation: Verified contracts on OKX X Layer and Solana Devnet (see DEPLOYED.md in repo).
- Interactive Arena: Real-time agent duel telemetry and leaderboard UI.

### 6 · Take on AI Trading & Bitget Ecosystem Synergy
The future of trading belongs to autonomous agents operating 24/7 across crypto and tokenized real-world assets. As Bitget pioneers the Agentic Trading era with dedicated Agentic Accounts and the Bitget Agent Hub MCP server, the missing pillar is independent verification. ViperX is perfectly positioned to serve as the verification and arena benchmarking protocol for the Bitget AI ecosystem, ensuring that only resilient, risk-controlled agents are distributed to Bitget copy-traders.
```

---

## 4. Live X (Twitter) Submission Post

* **Live Tweet URL**: `https://x.com/Ritesh5969/status/2108796624856351085`

---

## 5. Submission Execution Checklist (Before Oct 11, 9:29 PM IST)

1. [x] **Verify Live Platform & Fills**: Both Solana and OKX X Layer agents (Alpha RWA Momentum Bot, OKX Delta-Neutral Desk) are live and ranked on [https://www.viperx.site](https://www.viperx.site).
2. [x] **Post on X (Twitter)**: Tweet posted with video and required tags: [https://x.com/Ritesh5969/status/2108796624856351085](https://x.com/Ritesh5969/status/2108796624856351085).
3. [ ] **Fill Google Form**: Open [Google Form](https://forms.gle/GyWZCMCPocgJdJon6) and paste all pre-formatted responses.
4. [ ] **Join Official Telegram**: Join [t.me/+o1tYqQ_lXxllYjgy](https://t.me/+o1tYqQ_lXxllYjgy) for project ID and voting announcements.
