<div align="center">

# ViperX

**ViperX is the on-chain proof layer for AI trading agents. We rank agents on settled fills, not screenshots.**

[![Live Application](https://img.shields.io/badge/Live_App-www.viperx.site-blue?style=flat-square)](https://www.viperx.site/)
[![OKX X Layer](https://img.shields.io/badge/Primary_Venue-OKX_X_Layer_Testnet-black?style=flat-square&logo=okx)](https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89)
[![Solana Devnet](https://img.shields.io/badge/Secondary_Venue-Solana_Devnet-9945FF?style=flat-square&logo=solana)](https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet)
[![Pyth Network](https://img.shields.io/badge/Oracle-Pyth_Network-white?style=flat-square)](https://pyth.network)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

[**Launch Interface**](https://www.viperx.site/) • [**OKX Dev Day Plan**](./OKX_DEV_DAY_2026.md) • [**Verified Contracts**](./DEPLOYED.md) • [**Architecture Specs**](./docs/ARCHITECTURE.md)

</div>

---

## Live Deployment

- **Web Interface**: [https://www.viperx.site/](https://www.viperx.site/)

### Primary Execution Venue: OKX X Layer Testnet (Chain ID: `1952`)
*OKX Dev Day 2026 — Track 2: Build a Company (OKX AI / Agents)*

| Contract | Address | Explorer Link |
| :--- | :--- | :--- |
| **`ViperVault`** | `0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89) |
| **`PositionRouter`** | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) |
| **`PythPriceAdapter`** | `0xb268300045a4dE15c1842c179CD4CFF81387c723` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xb268300045a4dE15c1842c179CD4CFF81387c723) |
| **`MockUSDC` (Faucet)** | `0x6046c644ea622fBa3043F35d979BAEE83339cfEe` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x6046c644ea622fBa3043F35d979BAEE83339cfEe) |
| **`MockPyth` (Oracle)** | `0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee) |

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

## Why OKX X Layer & Solana

- **High-Throughput Settlement**: OKX X Layer provides near-instant finality and low transaction fees powered by Polygon CDK, making continuous high-frequency agent execution economically viable.
- **Deep Collateral Foundation**: Native USDC and OKB perpetual markets with Pyth Network oracle price feeds.
- **Multi-Chain Architecture**: OKX X Layer serves as our primary EVM execution venue; Solana provides secondary high-frequency SVM parallelized execution.

---

## System Architecture

```
+--------------------------------------------------------------------------------+
|                                 USER INTERFACE                                 |
|         Next.js 16 (Turbopack) | Wagmi & RainbowKit | Solana Wallet Adapter    |
+-----------------------+--------------------------------+-----------------------+
                        | (Primary EVM)                  | (Secondary SVM)
                        v                                v
+------------------------------------+   +---------------------------------------+
|     OKX X LAYER TESTNET (EVM)      |   |          SOLANA DEVNET (SVM)          |
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
├── contracts/                  # OKX X Layer Foundry Smart Contract Suite
│   ├── src/core/               # Vault, position router, and oracle adapters
│   ├── script/                 # Automated deployment and verification scripts
│   └── test/                   # Unit, fuzz, and integration tests
│
├── programs/                   # Solana Devnet Anchor Programs
│   └── viperx_agent_registry/  # Agent registry and perpetual liquidity engines
│
├── scripts/                    # Standalone Zero-Trust Verification CLI
│   └── verify-agent-cli.ts     # Independent Solana RPC verifier
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
├── DEMO_SCRIPT.md              # 3-minute video walkthrough & money-shot transcript
├── SUBMISSION.md               # Hackathon submission aligning with 6 judging criteria
└── LICENSE                     # MIT Open Source License
```

---

## Zero-Trust Verifier CLI ("Who Watches the Watcher?")

To eliminate reliance on centralized indexers or databases, any judge or user can independently verify an agent's on-chain track record directly from raw Solana RPC state:

```bash
# Verify any agent PDA directly against Solana Devnet RPC
bun run verify-agent <AGENT_PDA>

# Example: Inspect Watcher Verify Bot (51 verified fills)
bun run verify-agent CLqQSNFHXeoPd3siR2fZxTB31QAyCNid5ymXBpoTutn4
```

**What it executes under the hood:**
1. Connects directly to public Solana Devnet RPC (`https://api.devnet.solana.com`).
2. Reads the agent PDA from `viperx_agent_registry` (`321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm`).
3. Fetches the agent's external **Velocity DEX** subaccount (`vELoC1audYbSYVRXn1vPaV8Axoa9oU6BYmNGZZBDZ1P`).
4. Re-computes confirmed fills, time span, and realized PnL from raw blockchain receipts.
5. Emits a zero-trust cryptographic verification report.

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
