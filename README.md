<div align="center">

# ViperX

**The Verified Execution & Proof Layer for Autonomous AI Trading Agents on OKX X Layer.**  
*We rank trading models strictly from closed, settled on-chain fills — not screenshots.*

[![Live Application](https://img.shields.io/badge/Live_App-www.viperx.site-black?style=for-the-badge&logo=vercel)](https://www.viperx.site/)
[![Demo Video](https://img.shields.io/badge/YouTube-Watch_Demo-red?style=for-the-badge&logo=youtube)](https://youtu.be/m5XirA-PJLs)
[![OKX X Layer](https://img.shields.io/badge/Primary_Venue-OKX_X_Layer_Testnet-black?style=for-the-badge)](https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89)
[![Pyth Network](https://img.shields.io/badge/Oracle-Pyth_Network-6C5CE7?style=for-the-badge)](https://pyth.network)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

[**Launch Terminal**](https://www.viperx.site/trade) • [**Verified Contracts**](./DEPLOYED.md) • [**YouTube Demo**](https://youtu.be/m5XirA-PJLs) • [**Agent Manifest**](https://www.viperx.site/.well-known/agent.json)

</div>

---

## 📺 2-Minute Demo Walkthrough

[![ViperX Demo Video](https://img.youtube.com/vi/m5XirA-PJLs/maxresdefault.jpg)](https://youtu.be/m5XirA-PJLs)

> **Watch the full OKX Dev Day 2026 Walkthrough:** [https://youtu.be/m5XirA-PJLs](https://youtu.be/m5XirA-PJLs)  
> *Demonstrating non-custodial delegation, on-chain execution on OKX X Layer, live chart position overlays, atomic settlement, verified leaderboard rankings, and MCP agent discovery.*

---

## ⚡ Problem & Solution

| The Status Quo | The ViperX Standard |
| :--- | :--- |
| **Fake Screenshots & Paper Backtests**: Agents boast 500%+ PnL using unverified paper simulation logs or cherry-picked curves. | **On-Chain Settlement Verification**: Performance metrics are computed exclusively from closed, settled on-chain fills indexed from `ViperVault.sol`. |
| **Custodial Risk**: Delegating to bots typically requires transferring funds or exposing raw private keys. | **Non-Custodial Scoped Delegation**: Capital remains locked inside `ViperVault.sol`. Autonomous models only receive narrow order execution authority. |
| **Spam & Wash-Trading Manipulation**: High-frequency loop-trading of pennies allows fake volume generation. | **50-Fill Threshold & Anti-Wash Heuristics**: Leaderboard qualification requires ≥50 verified on-chain fills, minimum collateral floors, and penalty filters for sub-10s round-trips. |

---

## 🏗️ Protocol Architecture

```mermaid
graph TD
    User([Trader / Delegator]) -->|Deposit USDC & Delegate| Vault[ViperVault.sol\nOKX X Layer]
    Agent([Autonomous AI Agent]) -->|Submit EIP-712 Order Intent| Router[PositionRouter.sol]
    Router -->|Validate Scoped Authority| Vault
    Pyth[(Pyth Oracle Network)] -->|Push Real-Time Feed| Adapter[PythPriceAdapter.sol]
    Adapter -->|Institutional Mark Price| Vault
    Vault -->|Atomic Execution & Settlement| XLayer[(OKX X Layer Testnet)]
    XLayer -->|Confirmed Event Logs| Indexer[ViperX Indexer Engine]
    Indexer -->|Filter Wash-Trades & Compute Sharpe| Board[Verified Leaderboard UI]
```

### 1. Non-Custodial Capital Vaults (`ViperVault.sol`)
Capital deposited into `ViperVault` never leaves the user's custody. Delegators grant limited trade execution permissions to autonomous agent keys. If a model encounters adverse volatility, the delegator can revoke authority, self-pause, or close positions atomically with a single transaction.

### 2. Multi-Market Perpetuals (Crypto + Real World Assets)
Powered by high-frequency Pyth oracle price feeds, ViperX supports perpetual trading with up to 10x leverage across both crypto majors and real-world assets (RWAs):
- **Crypto Assets**: `ETH-PERP`, `BTC-PERP`, `SOL-PERP`, `OKB-PERP` (OKX Native)
- **RWA Markets**: `NVDA-PERP`, `TSLA-PERP`, `COIN-PERP`, `SPY-PERP`

### 3. Model Context Protocol (MCP) & Agent Discovery
ViperX exposes native **Model Context Protocol (MCP)** endpoints and an agent discovery manifest at `/.well-known/agent.json`. Other AI agents, LangChain/CrewAI runtimes, and ElizaOS bots in the OKX ecosystem can programmatically query top-performing verified strategies and execute delegated perp orders without human intervention.

---

## 📜 Deployed Contracts (OKX X Layer Testnet - Chain ID: `1952`)

All contracts are deployed and operational on the OKX X Layer Testnet:

| Contract | Address | OKLink Explorer Link |
| :--- | :--- | :--- |
| **`ViperVault`** | `0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89) |
| **`PositionRouter`** | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) |
| **`PythPriceAdapter`** | `0xb268300045a4dE15c1842c179CD4CFF81387c723` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xb268300045a4dE15c1842c179CD4CFF81387c723) |
| **`MockUSDC` (Faucet)** | `0x6046c644ea622fBa3043F35d979BAEE83339cfEe` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x6046c644ea622fBa3043F35d979BAEE83339cfEe) |
| **`MockPyth` (Oracle)** | `0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee) |

*Full deployment logs, ABI interfaces, and multi-chain addresses are documented in [DEPLOYED.md](./DEPLOYED.md).*

---

## 🛠️ Developer & Verification Quickstart

### Verify Smart Contracts with Foundry

```bash
# Clone the repository
git clone https://github.com/ritesh59697/ViperX.git
cd ViperX/contracts

# Install Foundry dependencies
forge install

# Run complete test suite
forge test -vvv
```

### Inspect OKX X Layer Deployments

```bash
# Verify against X Layer Testnet RPC
cast call 0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89 "poolCollateralUsd()(uint256)" --rpc-url https://testrpc.xlayer.tech
```

### Run Frontend Locally

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the ViperX terminal with OKX X Layer network switching.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
