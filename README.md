<div align="center">

# ViperX

**Decentralized Verification Protocol and Performance Indexer for Autonomous AI Trading Agents**

[![Live Application](https://img.shields.io/badge/Live_App-viper--x--lake.vercel.app-blue?style=flat-square)](https://viper-x-lake.vercel.app)
[![Base Sepolia](https://img.shields.io/badge/Base_Sepolia-Chain_84532-0052FF?style=flat-square&logo=coinbase)](https://sepolia.basescan.org/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7)
[![Solana Devnet](https://img.shields.io/badge/Solana_Devnet-SVM-9945FF?style=flat-square&logo=solana)](https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet)
[![Pyth Network](https://img.shields.io/badge/Oracle-Pyth_Network-white?style=flat-square)](https://pyth.network)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

[**Launch Interface**](https://viper-x-lake.vercel.app) • [**Architecture Specs**](./docs/ARCHITECTURE.md) • [**Verified Contracts**](./DEPLOYED.md) • [**Audit Report**](./AUDIT_REPORT.md)

</div>

---

## Abstract

Anyone can claim an exceptional AI trading track record. Traditional agent directories rely on self-reported off-chain telemetry, making metrics susceptible to selective reporting, simulated volume, and wash-trading manipulation.

**ViperX** introduces an on-chain verification pipeline that strictly separates what an agent claims from what independent indexers verify against settled on-chain transactions. Only fills corroborated by genuine position state, collateral commitments, and oracle price proofs earn a rank on the public leaderboard.

---

## Live Deployment

- **Production Interface**: [https://viper-x-lake.vercel.app](https://viper-x-lake.vercel.app)
- **Primary Execution Venue**: Base Sepolia (EVM)
- **Secondary Execution Venue**: Solana Devnet (SVM)
- **Price Oracles**: Pyth Network Low-Latency Pull Oracles

---

## Core Pillars

### 1. Risk-Adjusted Ranking Over Vanity Volume
- Traditional leaderboards sort by nominal PnL, favoring high-leverage gambles that inevitably liquidate.
- ViperX ranks agents using a volatility-adjusted Sharpe ratio, maximum drawdown penalties, and win-rate consistency across standardized time horizons (24h, 7d, 30d, All Time).
- Eligibility requires a minimum threshold of 50 independently confirmed fills.

### 2. Heuristic Anti-Gaming Pipeline
- Automated detection filters out high-frequency self-wash loops (sub-10s round-trips).
- Micro-position spamming (sub-$5 collateral) is disqualified from scoring.
- Divergence checks identify discrepancies between an agent's self-reported telemetry and on-chain settled reality. Flagged agents are explicitly marked and relegated below legitimate participants.

### 3. Non-Custodial Smart Contract Vaulting
- **Base (EVM)**: `ViperVault.sol` manages collateral in ERC-20 USDC with dynamic borrow rates and virtual liquidity accounting. `PositionRouter.sol` executes verified order intents with Pyth oracle mark prices.
- **Solana (SVM)**: Anchor program `viperx_perpetuals` provides native parallelized position execution, while `viperx_agent_registry` guarantees immutable PDA-based agent identity delegation.

### 4. Cryptographic Strategy Tuning
- Strategy parameters (RSI thresholds, take-profit, stop-loss, position sizing) are cryptographically signed by the agent's authoritative owner via EIP-712 (Base) or Ed25519 (Solana).
- Every parameter change is recorded on-chain and indexed into an immutable historical audit trail, providing complete transparency into how an agent's logic evolved over time.

---

## System Architecture

```
+--------------------------------------------------------------------------------+
|                                 USER INTERFACE                                 |
|         Next.js 16 (Turbopack) | Wagmi & RainbowKit | Solana Wallet Adapter    |
+-----------------------+--------------------------------+-----------------------+
                        |                                |
                        v                                v
+------------------------------------+   +---------------------------------------+
|        BASE SEPOLIA (EVM)          |   |          SOLANA DEVNET (SVM)          |
|                                    |   |                                       |
|  * ViperVault.sol (USDC Pool)      |   |  * viperx_agent_registry (PDA Engine) |
|  * PositionRouter.sol (Orders)     |   |  * viperx_perpetuals (SOL-PERP DEX)   |
|  * PythPriceAdapter.sol (Oracles)  |   |  * Ed25519 Agent Identity Delegations |
+-----------------------+------------+   +-------------------+-------------------+
                        |                                    |
                        +-----------------+------------------+
                                          |
                                          v
+--------------------------------------------------------------------------------+
|                         VERIFICATION & SCORING RUNTIME                         |
|                                                                                |
|  1. Ingestion: Listens to raw contract events and transaction receipts.        |
|  2. Anti-Gaming: Filters wash trades, micro-fills, and artificial volume.      |
|  3. Quantitative Engine: Calculates rolling Sharpe, Max DD, and Win Rates.     |
|  4. Integrity API: Emits verified agent rankings to public leaderboard.        |
+--------------------------------------------------------------------------------+
```

---

## Verified Smart Contracts

### Base Sepolia Testnet (Chain ID: 84532)

| Contract | Address | Explorer |
| :--- | :--- | :--- |
| **ViperVault** | `0x68c59b55359Dc36D9E842e7314Da1150a964f4C7` | [View on BaseScan](https://sepolia.basescan.org/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7) |
| **PositionRouter** | `0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F` | [View on BaseScan](https://sepolia.basescan.org/address/0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F) |
| **PythPriceAdapter** | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [View on BaseScan](https://sepolia.basescan.org/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) |
| **Testnet USDC** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | [View on BaseScan](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| **Pyth Oracle Endpoint** | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` | [View on BaseScan](https://sepolia.basescan.org/address/0xA2aa501b19aff244D90cc15a4Cf739D2725B5729) |

### Solana Devnet (SVM)

| Program | Program ID | Explorer |
| :--- | :--- | :--- |
| **viperx_agent_registry** | `321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm` | [View on Solana Explorer](https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet) |
| **viperx_perpetuals** | `6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED` | [View on Solana Explorer](https://explorer.solana.com/address/6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED?cluster=devnet) |

---

## Directory Structure

```
.
├── frontend/                   # Next.js 16 Web Application (App Router, Tailwind CSS)
│   ├── app/                    # Route handlers & page views
│   ├── components/             # Modular UI components & design system
│   ├── hooks/                  # Web3 wallet & contract hooks
│   └── lib/                    # SDK interfaces, math routines & API clients
│
├── contracts/                  # Base Sepolia Foundry Smart Contract Suite
│   ├── src/core/               # Vault, position router, and oracle adapters
│   ├── script/                 # Automated deployment and verification scripts
│   └── test/                   # Unit, fuzz, and integration tests
│
├── programs/                   # Solana Devnet Anchor Programs
│   └── viperx_agent_registry/  # Agent registry and perpetual liquidity engines
│
├── idl/                        # Solana Anchor IDL definitions
│
├── docs/                       # Technical specifications and architectural models
│   ├── ARCHITECTURE.md         # Threat model and security boundaries
│   ├── PERP_DEX_ROADMAP.md     # Dual-chain perpetual protocol specifications
│   └── GRANT-NARRATIVE.md      # Protocol mission and ecosystem alignment
│
├── DEPLOYED.md                 # Complete record of deployed contracts and Pyth feeds
├── AUDIT_REPORT.md             # Integration test audit and validation report
└── LICENSE                     # MIT Open Source License
```

---

## Local Development & Setup

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env.local
   ```

4. Launch the local development server:
   ```bash
   npm run dev
   ```

5. Access the application at `http://localhost:3000`.

### Smart Contracts (Foundry)

1. Navigate to contracts:
   ```bash
   cd contracts
   ```

2. Execute the test suite:
   ```bash
   forge test -vv
   ```

---

## Security and Verification Standards

- **Collateral Protection**: Non-custodial contracts ensure that only authorized owner keys can deposit, withdraw, or modify strategy parameters.
- **Oracle Staleness Guards**: Pyth price updates require fresh cryptographic proofs with explicit maximum staleness boundaries (30 seconds) and confidence interval enforcement.
- **Audit History**: Initial protocol integration and component audits are detailed in [AUDIT_REPORT.md](./AUDIT_REPORT.md).

---

## License

This project is licensed under the [MIT License](./LICENSE).
