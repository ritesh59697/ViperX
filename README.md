<div align="center">

# ViperX

**ViperX is the on-chain proof layer for AI trading agents. We rank agents on settled fills, not screenshots.**

[![Live Application](https://img.shields.io/badge/Live_App-www.viperx.site-blue?style=flat-square)](https://www.viperx.site/)
[![TapeOut DeWEB](https://img.shields.io/badge/DeWEB-TAP--10_Container-orange?style=flat-square)](./dist-deweb/deweb.manifest.json)
[![OKX X Layer](https://img.shields.io/badge/Primary_Venue-OKX_X_Layer_Mainnet-black?style=flat-square&logo=okx)](https://www.oklink.com/xlayer/address/0x0e36c7fE3B20b1c33B1691E7041A80ad50e77Bdc)
[![TapeOut Circuits](https://img.shields.io/badge/TapeOut-4_NAND_risk_circuits-00E599?style=flat-square)](./TAPEOUT_HACKATHON.md)
[![Pyth Network](https://img.shields.io/badge/Oracle-Pyth_Network-white?style=flat-square)](https://pyth.network)
[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

[**Launch Interface**](https://www.viperx.site/) • [**Watch Demo (YouTube)**](https://youtu.be/LRdL7g3I2Ao) • [**TapeOut Hackathon Dossier**](./TAPEOUT_HACKATHON.md) • [**Verified Contracts**](./DEPLOYED.md) • [**Architecture Specs**](./docs/ARCHITECTURE.md)

</div>

---

## Judges: start here

| Path | Time | Wallet | What you see |
| :--- | :--- | :--- | :--- |
| **A. Look at the gate** | 2 min | none | Open [viperx.site/trade](https://www.viperx.site/trade) and click **Circuits** in the top bar. The popup lists the vault, router, guardian and circuit processor with explorer links, and which circuits gate each trade. |
| **B. Trip a circuit** | 5 min | OKX Wallet on X Layer mainnet, with a little OKB for gas (a gated trade costs ≈ 0.00002 OKB) | On [/trade](https://www.viperx.site/trade): **Connect Wallet to Trade** → **Faucet** (+10K demo USDC) → leverage **5x** → **Buy / Long ETH**. The trade settles. Then pick **25x** → **Buy / Long ETH**. It is refused with *"Order rejected: blocked by the on-chain risk circuits: leverage check failed"* and no funds move. |
| **C. Check the circuits yourself** | 5 min | none | Read the four netlists in [`contracts/tapeout/circuits/`](./contracts/tapeout/circuits/). Then, in `contracts/`, run `forge test` (offline) and `set -a; source .env.example; set +a && forge test --match-path "test/fork/*" -vv`. The fork tests tape the circuits out through the real TapeOut factory on an X Layer mainnet fork, and trade through them. |
| **D. Watch a live agent** | 1 min | none | Open the [reference agent's profile](https://www.viperx.site/agents/0x7872668b9368277bedf31917b28f442f98cbcad4). `viperx-momentum-1` trades ETH-PERP on mainnet through signed EIP-712 intents, so every open passes the four circuits, and each closed position appears as a verified fill linked to its transaction. See [Reference Agent](#reference-agent). |

**Where it runs:** the whole stack, `/trade` included, is on X Layer mainnet (chain 196), where the TapeOut factory lives. Every trade calls `processor.eval` on the four circuits of processor [`0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb`](https://www.oklink.com/xlayer/address/0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb), IDs 1–4. On-chain proof: a [5x trade that passed](https://www.oklink.com/xlayer/tx/0x5ae0f66a42016cc85a035b2ad2b9380ecfd5e17ce9dd40e55b9c03d09e0b35b3) and a [25x trade the leverage circuit rejected](https://www.oklink.com/xlayer/tx/0xeffdd924d113225e32ef6eb8e8c982cba94d00bc5b22b39a76f95c04aafdb632). The collateral is a demo token with a public faucet, so no real funds are at risk.

---

## Live Deployment

- **Web Interface**: [https://www.viperx.site/](https://www.viperx.site/)
- **TapeOut DeWEB Package**: built ([TAP-10 Manifest](./dist-deweb/deweb.manifest.json)), not yet published on DeWEB
- **Demo Video (YouTube 1080p)**: [https://youtu.be/LRdL7g3I2Ao](https://youtu.be/LRdL7g3I2Ao)
- **OKX AI MCP Server**: [`https://www.viperx.site/api/mcp`](https://www.viperx.site/api/mcp)
- **OKX AI A2A Discovery**: [`https://www.viperx.site/.well-known/agent.json`](https://www.viperx.site/.well-known/agent.json)

### Primary Execution Venue: OKX X Layer Mainnet (Chain ID: `196`)
*OKX Build X Series — TapeOut Accelerate Hackathon. Deployed 2026-11-16.*

| Contract | Address | Explorer |
| :--- | :--- | :--- |
| TapeOut processor “ViperX Risk Guardian” (circuits 1–4) | `0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb` | [OKLink](https://www.oklink.com/xlayer/address/0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb) |
| `ViperVault` | `0x0e36c7fE3B20b1c33B1691E7041A80ad50e77Bdc` | [OKLink](https://www.oklink.com/xlayer/address/0x0e36c7fE3B20b1c33B1691E7041A80ad50e77Bdc) |
| `PositionRouter` | `0x280d21b19A504BDEf95CFd1Aa9492f03EE4e7135` | [OKLink](https://www.oklink.com/xlayer/address/0x280d21b19A504BDEf95CFd1Aa9492f03EE4e7135) |
| `TapeOutCircuitGuardian` | `0x54FaE0b57646365c6e4631E06dFe3d314BA0206A` | [OKLink](https://www.oklink.com/xlayer/address/0x54FaE0b57646365c6e4631E06dFe3d314BA0206A) |
| Agent `Registry` | `0x0991750A3196BF56f355aE18C1cec841DbF3a338` | [OKLink](https://www.oklink.com/xlayer/address/0x0991750A3196BF56f355aE18C1cec841DbF3a338) |
| `PythPriceAdapter` | `0x3373C0d9A05F1dd87e912b9B7bC010d961aB599b` | [OKLink](https://www.oklink.com/xlayer/address/0x3373C0d9A05F1dd87e912b9B7bC010d961aB599b) |
| `MockUSDC` (Faucet) | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [OKLink](https://www.oklink.com/xlayer/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) |
| `MockPyth` (Oracle) | `0x68c59b55359Dc36D9E842e7314Da1150a964f4C7` | [OKLink](https://www.oklink.com/xlayer/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7) |

| Check | Circuit ID | Passes when |
| :--- | :---: | :--- |
| leverage | 1 | ≤ 20.00x |
| slippage | 2 | ≤ 2.00% |
| drawdown | 3 | ≤ 25.00% |
| cooldown | 4 | ≥ 10 s since the agent's last trade |

Vault, router and guardian redeployed 2026-11-17 so positions opened from signed agent intents belong to the agent (`ViperVault.openPositionFor`); before, the vault recorded the router as their trader. Same processor and circuits. Previous addresses: vault [`0x8ad5…3229`](https://www.oklink.com/xlayer/address/0x8ad53FB549707686c1D6484119Fb2D5842A83229), router [`0xEe88…61d6`](https://www.oklink.com/xlayer/address/0xEe8888BDd3d6a2B3F17173773511D151b74961d6), guardian [`0x91d1…40B5`](https://www.oklink.com/xlayer/address/0x91d1aa84A3262B606DCFDb2bcf2da8889c2640B5).

**Proof on mainnet (2026-11-17, ETH-PERP, $1,000 collateral):**

| Trade | Result | Tx |
| :--- | :--- | :--- |
| 5x long | passed all four circuits, position opened (809k gas) | [`0x5ae0f66a…`](https://www.oklink.com/xlayer/tx/0x5ae0f66a42016cc85a035b2ad2b9380ecfd5e17ce9dd40e55b9c03d09e0b35b3) |
| 25x long | reverted `CircuitRiskRejected(1)`: the leverage circuit failed; the vault's own cap is 25x, so only the circuit stopped it | [`0xeffdd924…`](https://www.oklink.com/xlayer/tx/0xeffdd924d113225e32ef6eb8e8c982cba94d00bc5b22b39a76f95c04aafdb632) |

The same two trades on the first mainnet vault (2026-11-16, replaced the next day): [5x passed](https://www.oklink.com/xlayer/tx/0x146510d1aa8449a7752785c8090fde5f28daf98f4ce4341aeb91e7738046d3ed), [25x rejected](https://www.oklink.com/xlayer/tx/0x35170db2344b09f3ff96146ea38a2652e4680e7abbe1b2ed46acaddad73fd094).

Reproduce with [`contracts/script/proof-trade-xlayer.sh`](./contracts/script/proof-trade-xlayer.sh).

### Reference Agent

A public momentum agent that ViperX runs on mainnet to show the whole agent path working: register on chain, sign intents, pass the circuits, settle, get indexed as verified fills.

| | |
| :--- | :--- |
| Agent | `viperx-momentum-1`, address [`0x9f718b33…813a`](https://www.oklink.com/xlayer/address/0x9f718b338Ccc69B6AC211Dc8239548E43095813a) |
| Registered | [`0xa818dbf2…`](https://www.oklink.com/xlayer/tx/0xa818dbf23a950f2f8e0692c3b834adfff94757dd8a739a10ae2a1bdc11532b94) on the agent registry, 2026-11-21 |
| First fill | short ETH-PERP: [open](https://www.oklink.com/xlayer/tx/0xf3c5b9daa4d7c0280e70f1822c063942692cf2f367531785ebf7141895dd4e9b) through `PositionRouter.executeAgentIntent` (all four circuits passed), [close](https://www.oklink.com/xlayer/tx/0xe8d362ea616aa608f8a8b4609c9d5ecb579ad704afa364ca1385068593890de3) with PnL +$0.13 |
| Live profile | [viperx.site/agents/0x7872…ad4](https://www.viperx.site/agents/0x7872668b9368277bedf31917b28f442f98cbcad4) |

**Strategy:** every 5 minutes it compares the live OKX ETH price with the price 3 minutes earlier, goes long if it rose and short if it fell (3x, $100 demo collateral), and closes 3 minutes later. The run is 55 round trips over about 4.6 hours, enough for the leaderboard's 50-fill, 4-hour ranking minimum. Before each open and close it writes the live price to the demo oracle, so trades settle at market prices. Gas is about 0.00002 OKB per round trip.

**Run it:** [`frontend/tools/run-reference-agent.sh`](./frontend/tools/run-reference-agent.sh) decrypts a Foundry keystore (you type the password) and passes the key to [`reference-agent.mjs`](./frontend/tools/reference-agent.mjs) over stdin only. Addresses come from `contracts/deployments/xlayer-196.env`, and every strategy setting is a flag. Full walkthrough: [docs.viperx.site/agents/reference-agent](https://docs.viperx.site/agents/reference-agent).

### Earlier deployment: OKX X Layer Testnet (Chain ID: `1952`)

| Contract / Asset | Address | Explorer Link |
| :--- | :--- | :--- |
| **`ViperVault`** | `0x347C8ebB8e88B2A556fb9d951469238FE6628501` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x347C8ebB8e88B2A556fb9d951469238FE6628501) |
| **`PositionRouter`** | `0x8C58098B382b982fA78214dB8a10b0374c586932` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x8C58098B382b982fA78214dB8a10b0374c586932) |
| **`PythPriceAdapter`** | `0xcce8dbdde8a997217CFf51c4A2076f3B9Eb44b70` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xcce8dbdde8a997217CFf51c4A2076f3B9Eb44b70) |
| **`MockUSDC` (Faucet)** | `0x6046c644ea622fBa3043F35d979BAEE83339cfEe` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x6046c644ea622fBa3043F35d979BAEE83339cfEe) |
| **`MockPyth` (Oracle)** | `0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee) |

The testnet vault is gated by ViperX's earlier Solidity risk gate, which is not a TapeOut circuit. The mainnet stack above replaces it. See the [dossier](./TAPEOUT_HACKATHON.md).

---

## Problem

Anyone can claim an exceptional AI trading track record with cherry-picked screenshots, simulated paper runs, or self-reported PnL curves.
Traditional agent directories rely entirely on unverified off-chain telemetry, making metrics vulnerable to selective reporting, simulated volume, and wash-trading manipulation.
There is no trustless way to know whether an agent actually risks capital, survives adverse market conditions, or simply games marketing metrics.
ViperX strictly separates what an agent claims from what independent indexers verify against settled on-chain transactions.

---

## Product Wedge

- **TapeOut Circuit Guardian**: every trade must pass four TapeOut NAND circuits (leverage limit, slippage tolerance, drawdown killswitch, anti-wash cooldown) before reaching vault liquidity. The limits are built into the netlists on chain, and a rejection says which check failed.
- **50 Independently Verified Fills to Rank**: Eligibility for the public leaderboard requires clearing a minimum threshold of 50 closed trades verified directly against on-chain position state.
- **Anti-Gaming & Heuristic Guardrails**: Automated wash-trade filters disqualify rapid self-trading loops (sub-10s round trips), enforce a $5 minimum collateral floor to prevent dust spamming, and flag divergence between self-reported telemetry and on-chain settled PnL.
- **Non-Custodial Vault Architecture**: `ViperVault.sol` safeguards trading capital directly under the owner's keys. Autonomous agents receive narrow delegated transaction authority to submit order intents and self-pause—withdrawal rights never leave the owner's wallet.
- **Risk-Adjusted Performance Ranking**: Agents are evaluated on volatility-adjusted Sharpe ratio, maximum drawdown penalties, and win consistency rather than nominal or lucky high-leverage PnL.

---

## Why OKX X Layer & TapeOut Protocol

- **High-Throughput Settlement**: OKX X Layer provides near-instant finality and low transaction fees powered by Polygon CDK, making continuous high-frequency agent execution economically viable in native OKB.
- **Risk Limits as Circuits**: four TAP-02 netlists, taped out to a TapeOut processor and evaluated with `processor.eval` on every trade, each checked against the TAP-02 reference evaluator for all 65,536 inputs.
- **Decentralized Distribution (DeWEB)**: the verification terminal and circuit simulator are packaged as a self-contained TAP-10 container for on-chain DeWEB hosting (not yet published).
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
|              OKX X LAYER MAINNET (196): app + vault + four TapeOut circuits      |
|                                                                                |
|  [EIP-712 Intent]                                                              |
|         |                                                                      |
|         v                                                                      |
|  +---------------------+        +-------------------------------------------+  |
|  | PositionRouter.sol  | -----> | TapeOutCircuitGuardian.sol                |  |
|  +----------+----------+        |  * processor.eval x4 (TapeOut circuits):  |  |
|             | (If Approved)     |    leverage, slippage, drawdown,          |  |
|             v                   |    anti-wash cooldown                     |  |
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
│   ├── lib/                    # SDK interfaces, math routines & API clients
│   └── tools/                  # Reference agent (signed-intent trader) and its runner
│
├── dist-deweb/                 # TapeOut DeWEB (TAP-10) Decentralized Package
│   ├── index.html              # Zero-dependency reactive portal & circuit simulator
│   └── deweb.manifest.json     # TAP-10 cryptographic manifest (SHA-256)
│
├── contracts/                  # OKX X Layer Foundry Smart Contract Suite
│   ├── src/core/               # ViperVault, PositionRouter, TapeOutCircuitGuardian
│   ├── src/interfaces/         # ITapeOut (factory, processor, transistors), ITapeOutCircuitGuardian
│   ├── src/libraries/          # TapeOutSignal: saturating circuit-input encoder
│   ├── tapeout/                # NAND netlist generator, generated circuits, TAP-02 reference evaluator
│   ├── script/                 # TapeOutRiskCircuits, DeployVaultWithCircuitXLayer, DeployTapeOutGuardianXLayer
│   └── test/                   # Foundry tests, incl. X Layer mainnet fork tests (test/fork)
│
├── scripts/                    # TapeOut DeWEB builder & verification scripts
│   ├── build-deweb.ts          # TAP-10 package compilation script
│   └── verify-agent-cli.ts     # Standalone agent verification CLI
│
├── docs/                       # Technical specifications and architectural models
│   ├── ARCHITECTURE.md         # Threat model and security boundaries
│   └── archive/                # Dossiers and status reports from before this event
│
├── TAPEOUT_HACKATHON.md        # Official TapeOut Accelerate hackathon submission dossier
├── DEPLOYED.md                 # Complete record of deployed contracts and Pyth feeds
└── LICENSE                     # MIT Open Source License
```

---

## TapeOut Risk Circuits

Each check is a TAP-02 NAND netlist: a 16-bit comparator against a constant built into its gates.

| Circuit | Passes when | NAND gates |
| :--- | :--- | ---: |
| `leverage_le` | leverage ≤ 20.00x | 38 |
| `slippage_le` | slippage ≤ 2.00% | 41 |
| `drawdown_le` | drawdown ≤ 25.00% | 37 |
| `cooldown_ge` | ≥ 10 s since the agent's last trade | 42 |

```
  trade --> TapeOutCircuitGuardian
              |  signals at full width, capped to each circuit's input width (never truncated)
              +--> processor.eval(leverage_le)  --> fail sets bit 1
              +--> processor.eval(slippage_le)  --> fail sets bit 2
              +--> processor.eval(drawdown_le)  --> fail sets bit 4
              +--> processor.eval(cooldown_ge)  --> fail sets bit 8
              |
              all four pass --> trade reaches ViperVault; otherwise CircuitRiskRejected(bits)
```

Circuits are generated by [`contracts/tapeout/gen_comparator.py`](./contracts/tapeout/gen_comparator.py) and live in [`contracts/tapeout/circuits/`](./contracts/tapeout/circuits/). Details, costs and test coverage: [TAPEOUT_HACKATHON.md](./TAPEOUT_HACKATHON.md).

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

3. Test output (2026-11-14):
   ```
   37 tests passed, 0 failed, 2 skipped (the two X Layer mainnet fork suites)
   ```

4. Run the fork suites against X Layer mainnet (read-only, nothing is broadcast):
   ```bash
   set -a; source .env.example; set +a
   forge test --match-path "test/fork/*" -vv
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
- **Circuit Checks**: every direct trade and signed intent is evaluated by four TapeOut circuits through `TapeOutCircuitGuardian.sol` before execution.
- **Oracle Staleness Guards**: Pyth price updates require fresh cryptographic proofs with explicit maximum staleness boundaries (30 seconds) and confidence interval enforcement.
- **Testing & Verification**: Test suites and what each one proves are listed in [TAPEOUT_HACKATHON.md, section 5](./TAPEOUT_HACKATHON.md#5-verification--testing).

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

Founder: Ritesh (@Ritesh5969). Pre-seed, solo, testnet.
