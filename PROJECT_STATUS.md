# ViperX Protocol — Comprehensive Project Status & Master Overview

**Last Updated**: August 28, 2026  
**Repository**: `ritesh59697/ViperX`  
**Current Milestone**: Phase A (Production/Grant Ready) + Phase B (Dual-Chain Perp DEX Engine Initialized)  
**Supported Networks**: Base (Sepolia / Primary Venue) & Solana (Devnet / Secondary Venue)  

---

## 1. Executive Summary

**ViperX** is a dual-chain decentralized protocol designed for **Autonomous AI Trading Agents**. It combines:
1. **Verifiable Agent Identity & Risk-Adjusted Leaderboard**: AI trading bots deploy non-custodial wallets on Base & Solana and are ranked strictly on on-chain settled PnL and Sharpe ratio (not self-reported summaries).
2. **Automated Anti-Gaming & Wash-Trading Detection**: Real-time heuristics inspect sub-10s trade loops and PnL divergence, automatically disqualifying cheaters.
3. **Native Dual-Chain Perpetual DEX Engine**: An Oracle + Shared Liquidity Pool engine (GMX / JLP model) built on Base (Solidity / Foundry) and Solana (Rust / Anchor) allowing AI agents to trade perps with zero slippage against Pyth Network price feeds.

---

## 2. Master System Architecture

```
                               ┌─────────────────────────────────────────┐
                               │       ViperX Web Application (Next.js)  │
                               │  • Leaderboard     • AI Arena           │
                               │  • Agent Deployer  • User Dashboard     │
                               │  • Backtest Lab    • Paper Trading Lab  │
                               └────────────────────┬────────────────────┘
                                                    │
                      ┌─────────────────────────────┴─────────────────────────────┐
                      ▼                                                           ▼
         ┌────────────────────────┐                                  ┌────────────────────────┐
         │   Base Infrastructure  │                                  │  Solana Infrastructure │
         │   (Primary Venue)      │                                  │  (Secondary Venue)     │
         └────────────┬───────────┘                                  └───────────┬────────────┘
                      │                                                          │
      ┌───────────────┴───────────────┐                          ┌───────────────┴───────────────┐
      ▼                               ▼                          ▼                               ▼
┌──────────────┐                ┌──────────────┐           ┌──────────────┐              ┌──────────────┐
│ ViperVault   │                │PositionRouter│           │ Agent Registry│              │ Perpetuals   │
│ (ERC-4626 LP)│                │(EIP-712 SL/TP│           │  (Anchor PDA)│              │ (SOL-PERP)   │
└──────┬───────┘                └──────┬───────┘           └──────┬───────┘              └──────┬───────┘
       │                               │                          │                             │
       └──────────────┬────────────────┘                          └──────────────┬──────────────┘
                      │                                                          │
                      └─────────────────────────────┬────────────────────────────┘
                                                    ▼
                                    ┌───────────────────────────────┐
                                    │    ViperX Backend Pipeline    │
                                    │  • Leaderboard API (Postgres) │
                                    │  • On-Chain PnL Indexer       │
                                    │  • Anti-Gaming Heuristics     │
                                    │  • Autonomous Keeper Daemon   │
                                    └───────────────────────────────┘
```

---

## 3. What is Completed & Fully Operational

### 🟢 Phase A: Core Agent Platform & Leaderboard (100% Complete & Grant-Ready)

| Component | Directory / File | Description & Status |
| :--- | :--- | :--- |
| **Landing Page & Hero** | `frontend/app/page.tsx` | Real 8-stat protocol grid (4 live on-chain metrics + 4 invariants), silver smoked glass 3D illustrations, and live fraud heuristics status card. |
| **Risk Leaderboard** | `frontend/app/leaderboard/` | Risk-ranked performance board across multiple time windows (`24h`, `7d`, `30d`, `all`). |
| **Agent Deployer** | `frontend/app/create/` | On-chain registration interface for creating Base & Solana autonomous trading agents. |
| **AI Trading Arena** | `frontend/app/arena/` | Seasonal trading competition portal with wallet signature verification. |
| **User Dashboard** | `frontend/app/dashboard/` | Real-time portfolio manager, strategy parameter tuning, and copy-trading subscriptions. |
| **Quantitative Labs** | `frontend/app/backtest/` & `/paper/` | Historical backtesting engine and virtual capital simulation lab. |
| **Knowledge & Docs** | `frontend/app/specs/`, `/docs/`, `/guides/` | Interactive smart contract specifications, protocol documentation, and developer guides. |
| **Backend REST API** | `backend/leaderboard-api/` | Express + PostgreSQL service serving all platform stats, agent history, and leaderboard data (`10/10 endpoints verified 200 OK`). |
| **PnL & Sharpe Indexer** | `backend/pnl-indexer/` | VelocityWatcher event daemon tracking on-chain fills and computing verifiable Sharpe ratios. |
| **Solana Agent Registry** | `programs/viperx_agent_registry/` | Anchor program managing non-custodial agent PDA ownership and delegated execution authority. |
| **Branding & Assets** | `frontend/public/` | High-res multi-layer `favicon.ico`, Apple touch icon (`180x180`), and pure silver transparent PNG illustrations. |

---

### 🟡 Phase B: In-House Perpetual DEX Engine (Dual-Chain Initialized)

| Subsystem | Directory / Contracts | Status & Capabilities |
| :--- | :--- | :--- |
| **Base EVM Vault** | `contracts/src/core/ViperVault.sol` | **Completed & Tested**: ERC-4626 USDC liquidity pool (`vLP`), dynamic hourly borrow fee accumulator, and 5x max leverage Long/Short position execution. |
| **Base Intent Router** | `contracts/src/core/PositionRouter.sol` | **Completed & Tested**: EIP-712 cryptographic trade intent execution for AI agents + on-chain Stop-Loss and Take-Profit limit triggers. |
| **Pyth Price Normalizer** | `contracts/src/core/PythPriceAdapter.sol` | **Completed & Tested**: Integrates Pyth feeds with 30s staleness filters and confidence interval checks. |
| **Foundry Test Suite** | `contracts/test/` | **100% Pass Rate**: Automated unit & fuzz tests covering liquidity provision, 3x leverage longs/shorts, profit settlement, and liquidations (`forge test -vv`). |
| **Autonomous Keeper Bot** | `backend/keeper-bot/` | **Completed & Built**: TypeScript daemon monitoring Pyth mark prices to execute liquidations, trigger Stop-Loss orders, and update borrow rates. |
| **Solana SVM Perpetuals** | `programs/viperx_perpetuals/` | **Completed & Compiled**: Native Anchor program on Solana with `Pool`, `Market`, and `Position` PDAs for `SOL-PERP` trading. |

---

## 4. How to Run & Verify Every Component

### A. Run Frontend UI (`http://localhost:3000`)
```bash
cd frontend
npm run dev
```

### B. Run Backend API (`http://localhost:4000`)
```bash
cd backend/leaderboard-api
npm run dev
```

### C. Run Base EVM Smart Contract Tests (Foundry)
```bash
cd contracts
forge test -vv
```

### D. Run Keeper Bot Daemon
```bash
cd backend/keeper-bot
npm run dev
```

### E. Compile Solana Perpetuals Program (Anchor)
```bash
cd programs/viperx_agent_registry
cargo check --package viperx_perpetuals
```

---

## 5. Immediate Next Milestones

1. **Grant Application Submission**:
   - Phase A is 100% isolated, stable, and ready for review by grant committees (Solana Foundation, Superteam, Base Ecosystem).
2. **Base Sepolia Deployment**:
   - Broadcast `DeployViperPerp.s.sol` to Base Sepolia testnet.
3. **Agent Direct Execution Routing (Phase C)**:
   - Connect the ViperX execution runtime to route autonomous trades directly into the native `ViperVault` and `viperx_perpetuals` pools.
