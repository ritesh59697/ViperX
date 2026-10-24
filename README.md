<div align="center">

# ViperX

**ViperX is the on-chain proof layer for AI trading agents. We rank agents on settled fills, not screenshots.**

[![Live Application](https://img.shields.io/badge/Live_App-www.viperx.site-blue?style=flat-square)](https://www.viperx.site/)
[![TapeOut DeWEB](https://img.shields.io/badge/DeWEB-TAP--10_Container-orange?style=flat-square)](./dist-deweb/deweb.manifest.json)
[![OKX X Layer](https://img.shields.io/badge/Primary_Venue-OKX_X_Layer_Testnet-black?style=flat-square&logo=okx)](https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89)
[![TapeOut Circuit Guardian](https://img.shields.io/badge/Circuit_Guardian-ID_101_Active-00E599?style=flat-square)](./TAPEOUT_HACKATHON.md)
[![Pyth Network](https://img.shields.io/badge/Oracle-Pyth_Network-white?style=flat-square)](https://pyth.network)
[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

[**Launch Interface**](https://www.viperx.site/) • [**Watch Demo (YouTube)**](https://youtu.be/m5XirA-PJLs) • [**TapeOut Hackathon Dossier**](./TAPEOUT_HACKATHON.md) • [**Verified Contracts**](./DEPLOYED.md) • [**Architecture Specs**](./docs/ARCHITECTURE.md)

</div>

---

## Live Deployment

- **Web Interface**: [https://www.viperx.site/](https://www.viperx.site/)
- **TapeOut DeWEB Package**: `tape://viperx.tape` ([TAP-10 Manifest](./dist-deweb/deweb.manifest.json))
- **Demo Video (YouTube 1080p)**: [https://youtu.be/m5XirA-PJLs](https://youtu.be/m5XirA-PJLs)
- **OKX AI MCP Server**: [`https://www.viperx.site/api/mcp`](https://www.viperx.site/api/mcp)
- **OKX AI A2A Discovery**: [`https://www.viperx.site/.well-known/agent.json`](https://www.viperx.site/.well-known/agent.json)

### Primary Execution Venue: OKX X Layer Testnet (Chain ID: `1952`)
*OKX Build X Series — TapeOut Accelerate Hackathon*

| Contract / Asset | Address / ID | Explorer Link |
| :--- | :--- | :--- |
| **`PositionRouter`** | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) |
| **`ViperVault`** | `0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89) |
| **`PythPriceAdapter`** | `0xb268300045a4dE15c1842c179CD4CFF81387c723` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xb268300045a4dE15c1842c179CD4CFF81387c723) |
| **`MockUSDC` (Faucet)** | `0x6046c644ea622fBa3043F35d979BAEE83339cfEe` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x6046c644ea622fBa3043F35d979BAEE83339cfEe) |
| **`MockPyth` (Oracle)** | `0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee) |
| **TapeOut Circuit Guardian** | `Circuit ID: 101 (VIPERX_RISK_V1)` | Active on X Layer |

---

## Problem

Anyone can claim an exceptional AI trading track record with cherry-picked screenshots, simulated paper runs, or self-reported PnL curves.
Traditional agent directories rely entirely on unverified off-chain telemetry, making metrics vulnerable to selective reporting, simulated volume, and wash-trading manipulation.
There is no trustless way to know whether an agent actually risks capital, survives adverse market conditions, or simply games marketing metrics.
ViperX strictly separates what an agent claims from what independent indexers verify against settled on-chain transactions.

---

## Product Wedge

- **TapeOut Digital Logic Circuit Guardian**: Hardware-grade on-chain risk filtering. Every AI agent trade intent must pass combinational digital logic checks (leverage limit, slippage tolerance, drawdown killswitch, and anti-wash cooldown) before reaching vault liquidity.
- **50 Independently Verified Fills to Rank**: Eligibility for the public leaderboard requires clearing a minimum threshold of 50 closed trades verified directly against on-chain position state.
- **Anti-Gaming & Heuristic Guardrails**: Automated wash-trade filters disqualify rapid self-trading loops (sub-10s round trips), enforce a $5 minimum collateral floor to prevent dust spamming, and flag divergence between self-reported telemetry and on-chain settled PnL.
- **Non-Custodial Vault Architecture**: `ViperVault.sol` safeguards trading capital directly under the owner's keys. Autonomous agents receive narrow delegated transaction authority to submit order intents and self-pause—withdrawal rights never leave the owner's wallet.
- **Risk-Adjusted Performance Ranking**: Agents are evaluated on volatility-adjusted Sharpe ratio, maximum drawdown penalties, and win consistency rather than nominal or lucky high-leverage PnL.

---

## Why OKX X Layer & TapeOut Protocol

- **High-Throughput Settlement**: OKX X Layer provides near-instant finality and low transaction fees powered by Polygon CDK, making continuous high-frequency agent execution economically viable in native OKB.
- **Hardware-Grade Digital Logic**: TapeOut Circuit Guardian (Circuit ID: `101`) intercepts order intents on-chain, evaluating a 256-bit risk bus across digital comparators before state mutation.
- **Decentralized Distribution (DeWEB)**: The entire verification terminal and interactive circuit simulator is packaged into a self-contained TAP-10 container hosted on-chain, eliminating DNS and server single-points-of-failure.
- **Deep Collateral Foundation**: Native USDC and OKB perpetual markets with Pyth Network oracle price feeds.
- **Agentic Interoperability**: Exposes verified alpha through Model Context Protocol (`/api/mcp`) and Agent-to-Agent discovery (`/.well-known/agent.json`) for seamless integration with OKX Agentic Wallets.

---

## System Architecture

```
+--------------------------------------------------------------------------------+
|                       USER INTERFACE & DECENTRALIZED WEB                       |
|     Next.js 16 (Turbopack) | TapeOut DeWEB (TAP-10) | Wagmi & RainbowKit       |
+---------------------------------------+----------------------------------------+
                                        |
                                        v
+--------------------------------------------------------------------------------+
|                        OKX X LAYER TESTNET (CHAIN ID: 1952)                    |
|                                                                                |
|  [EIP-712 Intent]                                                              |
|         |                                                                      |
|         v                                                                      |
|  +---------------------+        +-------------------------------------------+  |
|  | PositionRouter.sol  | -----> | TapeOutCircuitGuardian.sol                |  |
|  +----------+----------+        |  * Circuit ID: 101 (VIPERX_RISK_V1)       |  |
|             | (If Approved)     |  * 256-bit Risk Bus (Leverage, Slippage,   |  |
|             v                   |    Drawdown Killswitch, Cooldown Latch)   |  |
|  +---------------------+        +-------------------------------------------+  |
|  | ViperVault.sol      |                                                       |
|  |  * Non-Custodial    | <----> PythPriceAdapter.sol (Low-latency feeds)       |
|  |  * Margin Pools     |                                                       |
|  +---------------------+                                                       |
+---------------------------------------+----------------------------------------+
                                        |
                                        v
+--------------------------------------------------------------------------------+
|                         VERIFICATION & SCORING RUNTIME                         |
|                                                                                |
|  1. Event Ingestion: Indexes closed position receipts directly on X Layer.    |
|  2. Anti-Gaming Heuristics: Disqualifies wash-trades and micro-fills (< $5).   |
|  3. Quantitative Engine: Computes volatility-adjusted Sharpe ratios & Max DD.  |
|  4. Integrity API: Emits verified agent rankings to public leaderboard.        |
+--------------------------------------------------------------------------------+
```

---

## Directory Structure

```
.
├── frontend/                   # Next.js 16 Web Application (OKX X Layer exclusive)
│   ├── app/                    # Route handlers & page views
│   ├── components/             # Modular UI components & design system
│   ├── hooks/                  # Web3 wallet & contract hooks
│   └── lib/                    # SDK interfaces, math routines & API clients
│
├── dist-deweb/                 # TapeOut DeWEB (TAP-10) Decentralized Package
│   ├── index.html              # Zero-dependency reactive portal & circuit simulator
│   └── deweb.manifest.json     # TAP-10 cryptographic manifest (SHA-256)
│
├── contracts/                  # OKX X Layer Foundry Smart Contract Suite
│   ├── src/core/               # ViperVault, PositionRouter, TapeOutCircuitGuardian
│   ├── src/interfaces/         # ITapeOutCircuitProcessor, ITapeOutCircuitGuardian
│   ├── script/                 # DeployTapeOutGuardianXLayer.s.sol
│   └── test/                   # Foundry test suite (13 passing tests)
│
├── scripts/                    # TapeOut DeWEB builder & verification scripts
│   ├── build-deweb.ts          # TAP-10 package compilation script
│   └── verify-agent-cli.ts     # Standalone agent verification CLI
│
├── docs/                       # Technical specifications and architectural models
│   └── ARCHITECTURE.md         # Threat model and security boundaries
│
├── TAPEOUT_HACKATHON.md        # Official TapeOut Accelerate hackathon submission dossier
├── DEPLOYED.md                 # Complete record of deployed contracts and Pyth feeds
├── INTEGRATION_REPORT.md       # End-to-end integration checklist and test pass report
└── LICENSE                     # MIT Open Source License
```

---

## TapeOut Circuit Guardian: 256-Bit Risk Bus

The **TapeOut Circuit Guardian** evaluates four combinational digital logic checks before any trade can touch vault liquidity:

```
+---------------------------------------------------------------------------------+
|                    TAPEOUT CIRCUIT GUARDIAN (X LAYER TESTNET)                   |
|                                                                                 |
|   Processor Contract: `ITapeOutCircuitProcessor`                                |
|   Circuit Container ID: 101 (`VIPERX_RISK_V1`)                                  |
|                                                                                 |
|   Input Bus (256-bit):                                                          |
|     - Bits 0..31:   Leverage Ratio (scaled 1e2, e.g. 2000 = 20.0x)              |
|     - Bits 32..63:  Slippage Tolerance Bps (e.g. 200 = 2.0%)                    |
|     - Bits 64..95:  Drawdown Bps (e.g. 2500 = 25.0%)                            |
|     - Bits 96..127: Cooldown Delta (seconds since last fill)                    |
|                                                                                 |
|   Digital Logic Comparators:                                                    |
|     COMP_0: Leverage <= 2000              ---> [Bit 0 PASS]                     |
|     COMP_1: Slippage <= 200 bps           ---> [Bit 1 PASS]                     |
|     COMP_2: Drawdown <= 2500 bps          ---> [Bit 2 PASS]                     |
|     COMP_3: Cooldown >= 10 seconds        ---> [Bit 3 PASS]                     |
|                                                     |                           |
|                                            [MASTER AND GATE]                    |
|                                                     |                           |
|                        Verdict: 1 = APPROVED  /  0 = REJECT (with Diag)         |
+---------------------------------------------------------------------------------+
```

---

## Local Development & Setup

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   bun install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   ```

3. Launch development server:
   ```bash
   bun run dev
   ```

4. Typecheck:
   ```bash
   bun x tsc --noEmit
   ```

### Smart Contracts (Foundry)

1. Navigate to contracts:
   ```bash
   cd contracts
   ```

2. Execute the full test suite:
   ```bash
   forge test
   ```

3. Test output:
   ```
   Ran 3 test suites: 13 passed, 0 failed, 0 skipped (13 total tests)
   ```

### Compile TapeOut DeWEB Container

1. Build the standalone TAP-10 container:
   ```bash
   bun run build:deweb
   ```

2. Output files will be generated in `dist-deweb/index.html` and verified via `dist-deweb/deweb.manifest.json`.

---

## Security & Verification Standards

- **Collateral Protection**: Non-custodial contracts ensure that only authorized owner keys can deposit, withdraw, or modify strategy parameters.
- **Hardware-Grade Circuit Checks**: Every signed intent is verified by `TapeOutCircuitGuardian.sol` before execution.
- **Oracle Staleness Guards**: Pyth price updates require fresh cryptographic proofs with explicit maximum staleness boundaries (30 seconds) and confidence interval enforcement.
- **Testing & Verification**: Contract test suites and integration verifications are documented in [INTEGRATION_REPORT.md](./INTEGRATION_REPORT.md).

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

Founder: Ritesh (@Ritesh5969). Pre-seed, solo, testnet.
