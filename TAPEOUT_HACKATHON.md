# OKX X Layer × TapeOut Accelerate Hackathon: ViperX Submission Dossier

> **Event:** OKX Build X Series — TapeOut Accelerate Hackathon  
> **Track:** Apps & Tools / Circuit Design  
> **Prize Pool:** 100,000+ USDT  
> **Primary Venue:** OKX X Layer Testnet (Chain ID: `1952`) / Mainnet (`196`)  
> **TapeOut Standards:** Digital Logic Circuit Container + DeWEB (TAP-10)

---

## 1. Executive Summary

**ViperX** is an autonomous, non-custodial quant trading protocol and proof-of-execution layer for AI agents. 

During the **TapeOut Accelerate Hackathon**, we introduced the **TapeOut Circuit Guardian (TCG)** and ported the **ViperX Verification Portal to TapeOut DeWEB (TAP-10)** on OKX X Layer:
1. **TapeOut Circuit Guardian (TCG):** An on-chain digital logic circuit module on X Layer that acts as a hardware-grade risk filter for AI agent order intents before they can touch vault liquidity.
2. **DeWEB Decentralized Hosting (TAP-10):** A 100% decentralized, verifiable web package where every byte of the leaderboard and circuit telemetry is hosted on-chain via TapeOut containers on X Layer.

---

## 2. What Was Added During the Hackathon

To satisfy the hackathon requirement (*"Existing projects are eligible but must include substantial new development completed during the event and describe what was added"*):

### A. TapeOut Digital Logic Circuit Guardian
- **Circuit Container ID:** `101` (`VIPERX_RISK_V1`)
- **Processor Interface:** [`ITapeOutCircuitProcessor.sol`](./contracts/src/interfaces/ITapeOutCircuitProcessor.sol)
- **Adapter Contract:** [`TapeOutCircuitGuardian.sol`](./contracts/src/core/TapeOutCircuitGuardian.sol)
- **PositionRouter Hook:** [`PositionRouter.sol`](./contracts/src/core/PositionRouter.sol) now validates every signed EIP-712 agent intent through the active TapeOut circuit on X Layer before trade execution.
- **Hardware-Grade Gate Checks:**
  - `GATE_0` (`COMP_LEVERAGE`): Max permitted leverage ratio (20.0x ceiling).
  - `GATE_1` (`COMP_SLIPPAGE`): Max allowed slippage tolerance (2.00% ceiling).
  - `GATE_2` (`COMP_DRAWDOWN`): Emergency circuit killswitch if agent drawdown exceeds 25.00%.
  - `GATE_3` (`LATCH_COOLDOWN`): Anti-wash trade timing latch enforcing a minimum 10-second gap between fills.
  - `AND_MASTER`: Master AND gate outputting high (1 = APPROVED) or low (0 = REJECT with diagnostic bits).

### B. TapeOut DeWEB Deployment Package (TAP-10)
- **DeWEB Build Script:** [`scripts/build-deweb.ts`](./scripts/build-deweb.ts) (run via `bun run build:deweb`)
- **Static Artifact:** [`dist-deweb/index.html`](./dist-deweb/index.html) (self-contained, reactive portal connecting directly to X Layer RPC)
- **Cryptographic Hash (SHA-256):** `323b09559ff9895c87e718741a962f96304651a2ed2132f3c36c3c19f43d9bd2`
- **TAP-10 Manifest:** [`dist-deweb/deweb.manifest.json`](./dist-deweb/deweb.manifest.json)
- **Interactive Circuit Simulator:** Built-in sandbox allowing judges to test combinational logic gates directly in the DeWEB client.

---

## 3. Circuit Architecture & Signal Bus

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

## 4. Verified Contracts on OKX X Layer (Chain ID: 1952)

| Contract / Asset | Address / ID | Explorer Link |
| :--- | :--- | :--- |
| **`PositionRouter`** | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [OKLink Explorer](https://www.oklink.com/xlayer-test/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) |
| **`ViperVault`** | `0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89` | [OKLink Explorer](https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89) |
| **`PythPriceAdapter`** | `0xb268300045a4dE15c1842c179CD4CFF81387c723` | [OKLink Explorer](https://www.oklink.com/xlayer-test/address/0xb268300045a4dE15c1842c179CD4CFF81387c723) |
| **`MockUSDC`** | `0x6046c644ea622fBa3043F35d979BAEE83339cfEe` | [OKLink Explorer](https://www.oklink.com/xlayer-test/address/0x6046c644ea622fBa3043F35d979BAEE83339cfEe) |
| **TapeOut Circuit ID** | `101` (`VIPERX_RISK_V1`) | Registered on X Layer Processor |

---

## 5. Verification & Testing

All unit tests for the TapeOut Circuit Guardian, signal bus packing, and `PositionRouter` integration run via Foundry:

```bash
cd contracts
forge test
```

### Test Suite Results:
- `test_CircuitGuardian_PassNormalTrade`: Normal trade (3x leverage, 1% slippage, 0% drawdown) passes.
- `test_CircuitGuardian_RevertOnLeverageBreach`: Reverts with diagnostic code `0x01` if leverage exceeds 20x.
- `test_CircuitGuardian_RevertOnSlippageBreach`: Reverts with diagnostic code `0x02` if slippage tolerance exceeds 2%.
- `test_CircuitGuardian_RevertOnAntiWashTradeCooldown`: Reverts with diagnostic code `0x08` if an agent re-enters within 10 seconds; passes once cooldown window elapses.
- `test_CircuitGuardian_RevertOnDrawdownKillswitch`: Reverts with diagnostic code `0x04` if agent exceeds 25% drawdown.

---

## 6. How to Submit to the Hackathon

1. **Submission Link:** [OKX Build X / TapeOut Accelerate Google Form](https://forms.gle/EoDNbxQ65dev1wFd9)
2. **Project Name:** ViperX (TapeOut Circuit Guardian & DeWEB)
3. **Category:** Apps, Tools & Circuit Design on X Layer
4. **Access Link:** [https://www.viperx.site/](https://www.viperx.site/) and DeWEB manifest `tape://viperx.tape`
5. **Circuit ID:** `101`
6. **New Development Summary:** 
   > *"Added on-chain TapeOut Circuit Guardian on OKX X Layer to enforce hardware-grade risk limits on autonomous trading agents before execution. Exported the verified agent leaderboard to TapeOut DeWEB (TAP-10) for 100% decentralized, verifiable web hosting on X Layer."*
7. **Demo Video Script:** Keep under 3 minutes, showing:
   1. The problem with unverified AI trading agents and uncontrolled risk.
   2. How the TapeOut Circuit Guardian evaluates orders through combinational logic on X Layer.
   3. Live execution of passing and blocked trade intents.
   4. The DeWEB portal with TAP-10 cryptographic hash verification.
