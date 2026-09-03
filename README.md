<div align="center">

# ViperX

**ViperX is the on-chain proof layer for AI trading agents on Base. We rank agents on settled USDC fills, not screenshots.**

[![Live Application](https://img.shields.io/badge/Live_App-viper--x--lake.vercel.app-blue?style=flat-square)](https://viper-x-lake.vercel.app)
[![Base Sepolia](https://img.shields.io/badge/Primary_Venue-Base_Sepolia-0052FF?style=flat-square&logo=coinbase)](https://sepolia.basescan.org/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7)
[![Solana Devnet](https://img.shields.io/badge/Secondary_Venue-Solana_Devnet-9945FF?style=flat-square&logo=solana)](https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet)
[![Pyth Network](https://img.shields.io/badge/Oracle-Pyth_Network-white?style=flat-square)](https://pyth.network)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

[**Launch Interface**](https://viper-x-lake.vercel.app) • [**Architecture Specs**](./docs/ARCHITECTURE.md) • [**Verified Contracts**](./DEPLOYED.md) • [**Integration Report**](./INTEGRATION_REPORT.md)

</div>

---

## Live Deployment

- **Web Interface**: [https://viper-x-lake.vercel.app](https://viper-x-lake.vercel.app)

### Primary Execution Venue: Base Sepolia (Chain ID: `84532`)

| Contract | Address | Explorer Link |
| :--- | :--- | :--- |
| **`ViperVault`** | `0x68c59b55359Dc36D9E842e7314Da1150a964f4C7` | [View on BaseScan](https://sepolia.basescan.org/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7) |
| **`PositionRouter`** | `0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F` | [View on BaseScan](https://sepolia.basescan.org/address/0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F) |
| **`PythPriceAdapter`** | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [View on BaseScan](https://sepolia.basescan.org/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) |
| **Testnet USDC** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | [View on BaseScan](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| **Pyth Oracle Endpoint** | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` | [View on BaseScan](https://sepolia.basescan.org/address/0xA2aa501b19aff244D90cc15a4Cf739D2725B5729) |

### Secondary Execution Venue: Solana Devnet (SVM)

| Program | Program ID | Explorer Link |
| :--- | :--- | :--- |
| **`viperx_agent_registry`** | `321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm` | [View on Solana Explorer](https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet) |
| **`viperx_perpetuals`** | `6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED` | [View on Solana Explorer](https://explorer.solana.com/address/6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED?cluster=devnet) |

---

## Problem

Anyone can claim an exceptional AI trading track record with cherry-picked screenshots, simulated paper runs, or self-reported PnL curves.
Traditional agent directories rely entirely on unverified off-chain telemetry, making metrics vulnerable to selective reporting, simulated volume, and wash-trading manipulation.
There is no trustless way to know whether an agent actually risks capital, survives adverse market conditions, or simply games marketing metrics.
ViperX strictly separates what an agent claims from what independent indexers verify against settled on-chain transactions.

---

## Product Wedge

- **50 Independently Verified Fills to Rank**: Eligibility for the public leaderboard requires clearing a minimum threshold of 50 closed trades verified directly against on-chain position state.
- **Anti-Gaming & Heuristic Guardrails**: Automated wash-trade filters disqualify rapid self-trading loops (sub-10s round trips), enforce a $5 minimum collateral floor to prevent dust spamming, and flag divergence between self-reported telemetry and on-chain settled PnL.
- **Non-Custodial Vault Architecture**: `ViperVault.sol` safeguards trading capital directly under the owner's keys. Autonomous agents receive narrow delegated transaction authority to submit order intents and self-pause—withdrawal rights never leave the owner's wallet.
- **Risk-Adjusted Performance Ranking**: Agents are evaluated on volatility-adjusted Sharpe ratio, maximum drawdown penalties, and win consistency rather than nominal or lucky high-leverage PnL.

---

## Why Base First

- **Native USDC Foundation**: Base provides deep native USDC liquidity as the primary trading and settlement asset, eliminating synthetic stablecoin friction for automated strategies.
- **Sub-Cent Agent Execution**: Ultra-low transaction fees enable continuous agent execution, frequent risk-adjustment rebalancing, and high-cadence position updates without gas cost degradation.
- **Coinbase Ecosystem Distribution**: Direct on-chain rails into the Coinbase user base and developer tooling provide natural distribution for verified agent vaults and future copy-trading subscriptions.
- **Multi-Chain Architecture**: Base is our primary home venue; Solana serves as a secondary expansion venue for parallelized SVM execution.

---

## System Architecture

```
+--------------------------------------------------------------------------------+
|                                 USER INTERFACE                                 |
|         Next.js 16 (Turbopack) | Wagmi & RainbowKit | Solana Wallet Adapter    |
+-----------------------+--------------------------------+-----------------------+
                        | (Default / Primary)            | (Secondary)
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
├── INTEGRATION_REPORT.md       # End-to-end integration checklist and test pass report
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

## Security & Verification Standards

- **Collateral Protection**: Non-custodial contracts ensure that only authorized owner keys can deposit, withdraw, or modify strategy parameters.
- **Oracle Staleness Guards**: Pyth price updates require fresh cryptographic proofs with explicit maximum staleness boundaries (30 seconds) and confidence interval enforcement.
- **Testing & Verification**: Contract test suites and integration verifications are documented in [INTEGRATION_REPORT.md](./INTEGRATION_REPORT.md).

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

Founder: Ritesh (@Ritesh5969). Pre-seed, solo, testnet.
