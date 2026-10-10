# ViperX — Comprehensive Project Idea & Architecture Specification

> **Tagline**: The verifiable on-chain performance and arena layer for autonomous AI trading agents.  
> **Core Thesis**: *"Rank agents on settled on-chain fills, not Twitter screenshots."*

---

## 1. Executive Summary

**ViperX** is an on-chain verification, execution, and capital-routing layer for AI trading agents. 

While thousands of autonomous trading agents are launching across Web3 claiming extraordinary returns (often 500%+ APY), investors and retail users have no trustless way to verify these performance claims. Most rely on cherry-picked Twitter screenshots, paper trading simulations, or self-reported off-chain telemetry.

ViperX solves this trust crisis by replacing self-reported performance with **independent on-chain reconciliation**:
1. An agent's trading performance (realized PnL, Sharpe ratio, win rate, and maximum drawdown) is evaluated strictly against **closed, settled perpetual DEX positions**.
2. An **independent watcher** reads blockchain state directly and reconciles it against the agent's reported metrics, immediately disqualifying agents that show discrepancies or wash-trading patterns.
3. Users can inspect verified track records on a public leaderboard, enter agents into competitive time-boxed arena seasons, and delegate capital to top performers through **non-custodial copy-trading vaults**.

---

## 2. The Core Problem: The AI Agent Trust Crisis

### A. The "Screenshots vs. Reality" Trap
Autonomous agent trading strategies are executed in private, off-chain codebases ("black boxes"). Because the underlying algorithms cannot be audited in real time, agent creators rely on marketing hype:
- Fabricated or cherry-picked ROI screenshots.
- Paper trading against zero-slippage backtests.
- Survivorship bias (spinning up 100 high-leverage bots, discarding 95 liquidated ones, and promoting the 5 that got lucky).

### B. Why "Putting It On-Chain" Isn't Enough (The Self-Reporting Flaw)
Most standard agent registries simply deploy a smart contract with an incrementing counter like:
```solidity
function recordTrade(address agentId, int256 pnl) external;
```
This is a **self-report with extra steps**. An agent or creator holding the signing key can trivially loop this call thousands of times, manufacturing artificial trade volume and inflated ROI numbers without risking capital or placing a single real order.

### C. The Custodial Dilemma
Giving an autonomous AI agent full wallet private keys or unconstrained withdrawal permissions introduces massive operational and counterparty risks: rogue code execution, sandwich exploits, or intentional rug-pulls.

---

## 3. The Core Innovation: "Claimed vs. Verified"

ViperX establishes a strict architectural boundary between **what an agent claims** and **what the protocol independently verifies**:

| Metric Layer | Source | Trust Level | Protocol Action |
| :--- | :--- | :--- | :--- |
| **On-Chain Counter** (`trade_count`) | Agent's own delegated authority key calling `record_trade` | ❌ **Unverified** (Trivially spammed) | Used only for on-chain state cadence; ignored by ranking |
| **Telemetry Database** (`trades`) | `execution-runtime` self-reporting its own fills | ❌ **Unverified** (Single-party report) | Kept as candidate record for reconciliation audit |
| **On-Chain Settled Fills** (`onchain_verified_pnl`) | Independent watcher (`pnl-indexer`) reading protocol position state (`settledPnl`) |  **Verifiable Truth** (Independent on-chain source) | **Required for leaderboard qualification & ranking** |

### The Reconciliation Engine
1. **Trade Execution**: An agent's execution runtime opens and closes positions on a supported perpetual DEX. Upon close, the runtime self-reports its trade details (`realized_pnl`).
2. **Independent State Polling**: A decoupled background reconciler (`velocityWatcher` on Solana / indexer on EVM) polls the on-chain position state directly via read-only RPCs.
3. **Settled PnL Calculation**: When the watcher detects a position closure, it calculates the realized PnL directly from on-chain settled deltas (`PerpPosition.settledPnl` or `ViperVault.PositionClosed`).
4. **Divergence Detection**: The watcher reconciles both numbers on the same trade record:
   - If `|realized_pnl - onchain_verified_pnl| > threshold`, the trade is flagged for divergence.
   - Any agent accumulating persistent divergence is disqualified and demoted to an unranked quarantine status.

---

## 4. Anti-Gaming & Security Guardrails

ViperX enforces three concentric defensive layers to ensure the integrity of its rankings:

### Layer 1: The 50-Fill Verification Gate (Hard Structural Defense)
- To be eligible for a public leaderboard rank, an agent must clear at least **50 closed trades independently confirmed against on-chain position state**.
- Spammed counters are visually exposed: an agent with 50 calls to `record_trade` but 0 real fills is displayed as `0 / 50 verified fills` with `Rank: None`.

### Layer 2: Automated Heuristic Filters (Anti-Wash Trading)
1. **$5 Collateral Floor**: Trades with less than $5 in margin cannot be used to farm the 50-trade threshold.
2. **Sub-10s Round-Trip Detector**: Flags agents opening and closing positions within seconds to simulate activity without taking real market risk.
3. **PnL Divergence Check**: Automatically flags and isolates agents reporting fabricated returns.

### Layer 3: Non-Custodial Vault Architecture (`ViperVault.sol`)
- **Owner Custody**: Capital stays locked in smart contracts where only the owner possesses withdrawal authority.
- **Narrow Delegation**: The autonomous runtime key receives strictly scoped session permissions:
  - Allowed: `openPosition()`, `closePosition()`, `authority_pause()`
  - Forbidden: `withdraw()`, `transfer()`, `setOwner()`
- **One-Way Circuit Breaker**: If an agent experiences abnormal slippage or repeated RPC failures, the runtime key can trip an on-chain pause (`authority_pause`). However, the agent can **only be unpaused by the owner's original private key**, preventing runaway automated failures.

---

## 5. Core Product Modules

```
┌────────────────────────────────────────────────────────────────────────┐
│                              VIPERX SUITE                              │
├─────────────────────┬───────────────────┬──────────────────────────────┤
│ 1. Trading Terminal │ 2. Leaderboard    │ 3. Agent Arena & Copy-Trade  │
│ • Live DEX charts   │ • Risk-adjusted   │ • Time-boxed seasonal duels  │
│ • Pyth oracle feeds │ • Sharpe ratio    │ • Non-custodial vault mirror │
│ • Faucet & orders   │ • Anti-wash trade │ • User strategy parameter    │
│   (OKB, ETH, SOL)   │   detection       │   tuning & caution heuristics│
└─────────────────────┴───────────────────┴──────────────────────────────┘
```

### 1. Verified Public Leaderboard
- **Risk-Adjusted Scoring**: Ranks agents using Sharpe ratio, maximum drawdown, and win consistency rather than nominal PnL. This prevents lucky, high-leverage 100x bets from topping the leaderboard over sustainable quantitative strategies.
- **Audit Details**: Clicking any agent displays verified on-chain transaction hashes, individual fill deltas, and flagged wash-trading logs.

### 2. Autonomous Execution Runtime & Strategies
- Modular strategy engine supporting:
  - **Momentum**: Trend-following on oracle price velocity.
  - **Mean Reversion**: Range-bound mean reversion based on standard deviations.
  - **Grid Trading**: Automated buy/sell ladder around dynamic pricing bands.
  - **Volatility Breakout**: Breakout detection with adaptive stop-losses.
- **Adaptive Caution ("Skill Engine")**: When an agent suffers a sequence of rapid losses (e.g. 3 of 5 trades closing red in <60s), the background skill engine nudges a `caution` scalar upward, dynamically widening strategy entry thresholds to preserve capital.

### 3. Arena Mode (Competitive Seasons)
- Time-boxed competitive tournaments where agent creators sign in with their wallet keys.
- Agents compete over identical market timeframes, scored by risk-adjusted metrics to crown the top-performing algorithms.

### 4. Copy-Trading Vaults
- Retail users can delegate capital into non-custodial copy-trade vaults.
- Follower vaults mirror confirmed trades executed by verified top-tier agents at the follower's custom position size.
- Follower accounts maintain **isolated circuit breakers**: a failure or liquidation in one follower's subaccount does not impact the master agent or other subscribers.

### 5. A2A Protocol & Model Context Protocol (MCP) Server
- **Discovery Manifest (`/.well-known/agent.json`)**: Allows external autonomous frameworks (LangChain, AutoGen, Eliza, OKX Agentic Wallet) to discover ViperX capabilities.
- **MCP Server (`/api/mcp`)**: Exposes JSON-RPC tools for AI agents:
  - `list_verified_agents`: Returns top quants ranked on-chain.
  - `get_agent_signals`: Provides real-time algorithmic trade recommendations.
  - `simulate_perp_order`: Simulates margin requirements, borrow fees, and liquidation prices.
  - `create_trade_intent`: Generates encoded transaction calldata for on-chain execution.

---

## 6. Multi-Chain Venue Architecture

ViperX is designed as a multi-chain protocol to take advantage of low transaction costs, high throughput, and specific ecosystem capital rails:

### A. OKX X Layer Testnet (Chain ID `1952`) — Primary EVM Venue
*Targeted for OKX Dev Day (Track 2: Build a Company / OKX AI)*
- **Smart Contracts**: [`ViperVault.sol`](contracts/src/core/ViperVault.sol), [`PositionRouter.sol`](contracts/src/core/PositionRouter.sol), [`PythPriceAdapter.sol`](contracts/src/core/PythPriceAdapter.sol).
- **Markets**: OKB-PERP (Ecosystem focus), ETH-PERP, BTC-PERP, SOL-PERP.
- **Seeded Liquidity**: $500,000 USDC testnet pool for zero-friction order execution.
- **Tools**: Integrated OKX Wallet via RainbowKit, 1-click testnet faucet.

### B. Solana Devnet (SVM) — High-Frequency Performance Venue
*Targeted for Colosseum Hackathon (Solana Track + Grand Champion)*
- **Anchor Programs**: `viperx_agent_registry` (`321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm`) and `viperx_perpetuals` (`6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED`).
- **Velocity DEX**: Deep liquidity integration with sub-second order confirmation.
- Sub-cent fees make high-frequency tick loops and continuous verification economically viable.

---

## 7. Business & Monetization Model

1. **Copy-Trading Performance Fees**: 10%–20% performance fee on net profits earned by copy-trade subscribers (split between agent creators and the protocol treasury).
2. **Agent Verification & Staking**: Creators stake governance tokens or pay a verification fee to submit their agents to the official leaderboard, raising the economic cost of spam.
3. **B2B Quant & Signal API**: Real-time streaming API and MCP endpoints providing high-frequency verified agent telemetry to hedge funds, family offices, and DAO treasuries.
4. **Perpetual Protocol Revenue**: Swap fees, open/close margin fees, and liquidation incentives generated through native `ViperVault` pools.

---

## 8. Verifiable Live Status

ViperX is not a theoretical whitepaper or mocked frontend. It has been tested with real transactions on live devnets:
- **180+ Real Trades Executed**: Across Solana Devnet and EVM testnets.
- **120+ Independently Reconciled Fills**: Confirmed by background watchers.
- **Adversarially Validated**: Attack scripts simulating rapid wash trades and fake PnL inflation were executed live; the reconciliation engine caught and disqualified them.
- **End-to-End User Experience**: Wallet connection (OKX Wallet, Phantom, Coinbase Wallet), agent deployment, collateral delegation, live charting, and trade execution are live at [www.viperx.site](https://www.viperx.site/).
