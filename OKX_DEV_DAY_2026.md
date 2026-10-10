# OKX Dev Day 2026 — Official Submission Package & Master Guide

> **Status:** Final Deliverable Ready 🚀  
> **Team:** ViperX  
> **Project:** ViperX — Verified AI Agent Marketplace & Autonomous Perpetual DEX  
> **Primary Track:** Build a Company (OKX AI / Agents) with OKX X Layer EVM Deployment  
> **Participation Route:** Remote Build (Eligible for $35K Track 2 + $15K Remote prize pool; Singapore Finale on Oct 7)  
> **Submission Deadline:** Sep 25, 2026 @ 23:59 UTC

---

## 1. Executive Summary

### The Problem
Anyone can claim an exceptional AI trading track record using simulated paper runs, survivorship bias, or cherry-picked screenshots. Traditional agent directories rely entirely on unverified off-chain telemetry, making metrics vulnerable to selective reporting, simulated volume, and wash-trading manipulation.

### The ViperX Solution on OKX X Layer
ViperX is the first **on-chain proof and execution layer for AI trading agents**:
1. **Verified Risk-Adjusted Ranking:** Agents are ranked strictly on closed, settled on-chain fills. Metrics include Sharpe ratio, win rate, and maximum drawdown penalties.
2. **50 Independently Verified Fills to Rank:** Agents must clear at least 50 on-chain trades before qualifying for the public leaderboard.
3. **Anti-Gaming Reconciliation Watcher:** Automated heuristic filters flag wash trades (sub-10s round trips), enforce a $5 minimum collateral floor, and slash divergent agents.
4. **Non-Custodial Vault Architecture (`ViperVault.sol`):** User capital never leaves the user's custody. Delegated session keys/agent wallets submit order intents, but withdrawal rights remain strictly with the owner.
5. **OKX AI & A2MCP Interoperability:** External AI agents can discover verified top quants, query directional market alpha signals, and simulate/execute perpetual orders via standard Model Context Protocol (MCP) and Agent-to-Agent (A2A) endpoints.

---

## 2. Verified Deployments on OKX X Layer Testnet (Chain ID: `1952`)

All contracts were compiled with Foundry and deployed on **OKX X Layer Testnet** via deployer address [`0x9f718b338Ccc69B6AC211Dc8239548E43095813a`](https://www.oklink.com/xlayer-test/address/0x9f718b338Ccc69B6AC211Dc8239548E43095813a).

| Contract | Address | OKLink Explorer Link | Deployment Tx Hash |
| :--- | :--- | :--- | :--- |
| **`ViperVault`** | `0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89) | [`0x0d3245fc...`](https://www.oklink.com/xlayer-test/tx/0x0d3245fc99837df8ad686dbc99ac7dbeabc4383972578e5035c69e5cff56e354) |
| **`PositionRouter`** | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) | [`0x441771a4...`](https://www.oklink.com/xlayer-test/tx/0x441771a4509fd57e25f5fc947c8e43a296e7462894ff4edca7963700b626b30c) |
| **`PythPriceAdapter`** | `0xb268300045a4dE15c1842c179CD4CFF81387c723` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xb268300045a4dE15c1842c179CD4CFF81387c723) | [`0x3d062837...`](https://www.oklink.com/xlayer-test/address/0xb268300045a4dE15c1842c179CD4CFF81387c723) |
| **`MockUSDC` (Faucet)** | `0x6046c644ea622fBa3043F35d979BAEE83339cfEe` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x6046c644ea622fBa3043F35d979BAEE83339cfEe) | [`0x8ab4470a...`](https://www.oklink.com/xlayer-test/tx/0x8ab4470a145bf343d9cbba788d183367df5792013ec9181d1a9bea010ab8b541) |
| **`MockPyth` (Oracle)** | `0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee) | [`0x465de4c4...`](https://www.oklink.com/xlayer-test/tx/0x465de4c4d54ed4a90947c411e82f72ef6575aea38e51aebe23c41d7e376ebc6c) |

### Active Perpetual Markets on X Layer

| Market Symbol | Feed Identifier | Max OI (Long / Short) | Max Leverage | Min Collateral |
| :--- | :--- | :--- | :---: | :---: |
| **`OKB-PERP`** *(OKX Ecosystem)* | `keccak256("OKB-USD-FEED")` | $500,000 / $500,000 | 5x (20% margin) | $5.00 |
| **`ETH-PERP`** | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` | $1,000,000 / $1,000,000 | 5x (20% margin) | $10.00 |
| **`BTC-PERP`** | `0xe62df6e875746b43f8000b0b152753545192ddc4203240d23e1112c0200ecd92` | $2,000,000 / $2,000,000 | 5x (20% margin) | $20.00 |
| **`SOL-PERP`** | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` | $500,000 / $500,000 | 5x (20% margin) | $5.00 |

*Liquidity Seeded:* **$500,000 USDC** was minted and deposited into `ViperVault` during initialization to guarantee deep order execution for testing.

---

## 3. OKX AI Integration: A2A Protocol & Model Context Protocol (A2MCP)

ViperX exposes its verified quant engine and execution layer to other autonomous agents in the OKX ecosystem through standard A2A and MCP protocols:

### A. Discovery Manifest (`/.well-known/agent.json`)
The public discovery file allows any agent framework (LangChain, AutoGen, Eliza, OKX Agentic Wallet) to automatically discover ViperX capabilities:
```json
{
  "name": "ViperX Autonomous Quant Engine",
  "version": "1.0.0",
  "endpoint": "/api/mcp",
  "a2aEndpoint": "/api/okx-ai/a2a",
  "network": {
    "name": "OKX X Layer Testnet",
    "chainId": 1952,
    "rpcUrl": "https://testrpc.xlayer.tech"
  }
}
```

### B. Model Context Protocol Server (`/api/mcp`)
A full JSON-RPC 2.0 MCP server exposing 5 tools for quants and AI agents:
1. `list_verified_agents`: Returns top AI trading agents ranked on-chain by Sharpe ratio, win rate, and max drawdown.
2. `get_agent_signals`: Provides real-time algorithmic trade recommendations for OKX X Layer perpetual markets.
3. `get_xlayer_markets`: Inspects active perpetual markets on X Layer with fee and leverage limits.
4. `simulate_perp_order`: Simulates margin requirements, estimated liquidation price, and borrow fees before executing.
5. `create_trade_intent`: Generates encoded transaction calldata for OKX Agentic Wallet or PositionRouter.

#### Sample MCP Call:
```bash
curl -X POST https://www.viperx.site/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "simulate_perp_order",
      "arguments": {
        "market": "OKB-PERP",
        "side": "long",
        "collateralUsd": 100,
        "leverage": 3
      }
    }
  }'
```

#### Sample Response:
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": {
          "market": "OKB-PERP",
          "side": "long",
          "collateralUsd": 100,
          "leverage": "3x",
          "positionSizeUsd": 300,
          "entryPrice": 46.5,
          "estimatedLiquidationPrice": 34.4,
          "maintenanceMarginRequirement": "5.0% ($15.00)",
          "venue": "ViperVault (OKX X Layer Testnet)"
        }
      }
    ]
  }
}
```

---

## 4. Frontend & User Experience Highlights

1. **Native OKX Wallet Connector:** Integrated `@rainbow-me/rainbowkit` with the official OKX Wallet connector prominently featured.
2. **Network Selector:** 1-click switching between **OKX X Layer Testnet (Chain ID 1952)**, Base Sepolia, and Solana Devnet.
3. **1-Click Testnet Faucet:** Users connecting an EVM wallet can click **"Claim 10,000 Testnet USDC"** right inside the `/trade` terminal to immediately fund their account from `MockUSDC.sol`.
4. **On-Chain Order Execution:** Direct interactive market orders with real-time slippage protection, liquidation price calculation, and OKLink transaction receipts.
5. **Agent Deployer on X Layer (`/create`):** Users can launch autonomous AI agents with specialized strategies (Momentum, Mean Reversion, Grid, Volatility Breakout) specifically configured for OKX X Layer.
6. **Agent Leaderboard (`/leaderboard`):** Ranks agents across chains with dedicated "X Layer" badges, showing on-chain verified trade count and reconciliation scores.

---

## 5. Backend Execution Runtime Driver

In [`backend/execution-runtime/src/drivers/viperXLayerPerpDriver.ts`](file:///Users/ritesh/Projects/viperx/backend/execution-runtime/src/drivers/viperXLayerPerpDriver.ts):
- Fully implements the `ExecutionDriver` interface.
- Reads oracle prices dynamically from `PythPriceAdapter` on X Layer.
- Manages USDC approvals and submits `openPosition` / `closePosition` calls directly to `ViperVault.sol`.
- Automatically posts closed trade telemetry to PostgreSQL for real-time reconciliation and anti-gaming verification.

---

## 6. Official 2–4 Minute Video Demo Walkthrough Script

Use this script when recording your hackathon submission video:

### [0:00 – 0:35] Problem & Value Proposition
> "Hello OKX Dev Day judges. Welcome to ViperX.  
> Right now, AI trading agents are exploding across Web3, but there's a fatal flaw: **there is zero trust**. Anyone can claim a 400% APY using simulated paper trading or cherry-picked screenshots.  
> We built ViperX to solve this. ViperX is the **on-chain proof layer and autonomous perpetual DEX for AI trading agents**. We rank agents strictly on cryptographically verified, settled USDC fills on OKX X Layer—not screenshots."

### [0:35 – 1:30] Architecture & OKX X Layer Deployment
> "For OKX Dev Day, we deployed our core perpetual protocol natively onto **OKX X Layer Testnet** at Chain ID 1952.  
> Our architecture centers around `ViperVault.sol`, a non-custodial capital pool seeded with $500,000 USDC. Agents receive narrow delegated signing keys to submit trade intents through our `PositionRouter`, but they can never withdraw your funds.  
> We have 4 active perpetual markets live right now: Bitcoin, Ethereum, Solana, and the native **OKB-PERP** market, using our `PythPriceAdapter`.  
> Every fill, margin deposit, and PnL realization happens directly on X Layer, taking advantage of its sub-second finality and near-zero gas costs."

### [1:30 – 2:30] Live Terminal Demo (OKX Wallet + Faucet + Trade Execution)
> "Let's see it in action on the live interface at `viperx.site/trade`.  
> First, I connect my **OKX Wallet**. Notice our network switcher instantly points to **OKX X Layer Testnet**.  
> If you need testnet funds, you don't have to hunt for Discord faucets—simply click the **'Faucet'** button right here in the order form. In one transaction, 10,000 Mock USDC is minted directly to your wallet.  
> Now let's open an **OKB-PERP Long** position. We enter $100 of margin with 3x leverage. We click 'Place Long Order', sign with OKX Wallet, and within one second the position is confirmed!  
> Clicking the transaction hash takes us directly to **OKLink**, proving the position was opened on `ViperVault` at address `0x01e417...`.  
> Our independent watcher monitors this fill, verifying that the execution matches the agent's strategy before ranking it on our public leaderboard."

### [2:30 – 3:15] OKX AI Integration: A2A & Model Context Protocol (A2MCP)
> "Next, let's talk about our OKX AI integration. ViperX isn't just a UI—it's an **autonomous intelligence engine for the OKX AI ecosystem**.  
> We have implemented the **Model Context Protocol (MCP)** standard at `/api/mcp` and the A2A discovery manifest at `/.well-known/agent.json`.  
> Any AI agent in the OKX ecosystem can send standard JSON-RPC 2.0 requests to query our verified leaderboard, stream real-time directional signals on OKB perps, and simulate order parameters like margin and liquidation price before committing on-chain capital.  
> Here in our terminal, you can see our automated verification suite passing 100% of MCP tool calls: listing verified agents, fetching alpha signals, and preparing executable calldata."

### [3:15 – 3:45] Conclusion & Future Roadmap
> "ViperX brings institutional-grade risk verification and autonomous execution to OKX X Layer.  
> Our next steps include integrating the OKX Agentic Wallet for session keys and launching our $OKB liquidity pool on X Layer Mainnet.  
> Thank you, and we look forward to presenting at the Singapore Finale on October 7!"

---

## 7. Submission Form Quick Reference (Google Form)

When filling out the [Official Google Form](https://forms.gle/81S2gnFCzqSoeDEA7), use these exact details:

- **Project Name:** ViperX
- **Team Lead / Members:** Ritesh & ViperX Team
- **Track Selection:** Track 2: Build a Company (OKX AI / Agents) AND Remote Build
- **GitHub Repository:** `https://github.com/ritesh59697/ViperX-main` (or project repo URL)
- **Live Application URL:** `https://www.viperx.site/`
- **Smart Contract Addresses (OKX X Layer Testnet, Chain ID 1952):**
  - `ViperVault`: `0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89`
  - `PositionRouter`: `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A`
  - `PythPriceAdapter`: `0xb268300045a4dE15c1842c179CD4CFF81387c723`
  - `MockUSDC` (Faucet): `0x6046c644ea622fBa3043F35d979BAEE83339cfEe`
  - `MockPyth`: `0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee`
- **OKLink Explorer:** `https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89`
- **OKX AI MCP Endpoint:** `https://www.viperx.site/api/mcp`
- **OKX AI A2A Discovery Manifest:** `https://www.viperx.site/.well-known/agent.json`
- **One-Sentence Description:** "ViperX is the verified on-chain proof layer and autonomous perpetual DEX on OKX X Layer, ranking AI trading agents on settled USDC fills rather than unverified screenshots."
