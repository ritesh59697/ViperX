# OKX X Layer × TapeOut Accelerate Hackathon: ViperX Submission Dossier

> **Event:** OKX Build X Series — X Layer TapeOut Accelerate
> **Official page:** https://web3.okx.com/xlayer/build-x-series
> **Submission deadline:** December 7, 2026, 23:59 UTC (*provisional* — the event page will confirm the final date)
> **Prize Pool:** 100,000 USDT — 1st (1 winner) 20,000 · 2nd (5 winners) 10,000 each · 3rd (5 winners) 6,000 each, paid in milestone stages
> **Network:** X Layer **mainnet** (chain `196`) for the TapeOut circuits — the TapeOut factory and processors exist only there. The ViperX app and its earlier risk gate run on X Layer testnet (`1952`).
> **TapeOut components used:** Digital Logic Circuits (four NAND netlists on one processor) · DeWEB (TAP-10, package built, not yet published)

> **Status (2026-11-14):** the four risk circuits are generated, verified, and taped out on a **fork** of X Layer mainnet, where a ViperVault trade is gated by four real `processor.eval` calls. **Nothing is on mainnet yet**: the processor address and circuit IDs in section 7 come from the real tape-out, which needs ~0.11 BEM on X Layer (bridged from BNB Chain) and ~0.006 OKB.

---

## 1. Executive Summary

**ViperX** is a non-custodial perpetuals venue and proof-of-execution layer for AI trading agents.

During the **TapeOut Accelerate Hackathon** we added:
1. **Four TapeOut risk circuits:** leverage, slippage, drawdown and anti-wash cooldown, each a TAP-02 NAND netlist taped out to a processor created by the TapeOut factory. The risk limits live inside the netlists on chain, not in Solidity.
2. **TapeOut Circuit Guardian:** the contract that turns a trade into circuit inputs and calls `processor.eval` on all four circuits before the trade touches vault liquidity — both direct UI trades (`ViperVault.openPosition()`) and signed agent intents (`PositionRouter.executeAgentIntent()`).
3. **DeWEB package (TAP-10):** a self-contained verification portal and circuit simulator packaged for TapeOut DeWEB hosting.

---

## 2. What Was Added During the Hackathon

The rules state that existing projects are eligible but *only work completed during the event will be judged*. Everything in this section was built during the event.

### A. The four risk circuits (TAP-02 netlists)

| Circuit | Passes when | Input | NAND gates | Verified |
| :--- | :--- | :--- | ---: | :--- |
| [`leverage_le`](./contracts/tapeout/circuits/leverage_le.json) | leverage x100 ≤ 2000 (20.00x) | 16-bit | 38 | all 65,536 inputs |
| [`slippage_le`](./contracts/tapeout/circuits/slippage_le.json) | slippage ≤ 200 bps (2.00%) | 16-bit | 41 | all 65,536 inputs |
| [`drawdown_le`](./contracts/tapeout/circuits/drawdown_le.json) | drawdown ≤ 2500 bps (25.00%) | 16-bit | 37 | all 65,536 inputs |
| [`cooldown_ge`](./contracts/tapeout/circuits/cooldown_ge.json) | ≥ 10 s since the agent's last trade | 16-bit | 42 | all 65,536 inputs |

- **Generator:** [`contracts/tapeout/gen_comparator.py`](./contracts/tapeout/gen_comparator.py) builds a constant comparator (`--max K` for x ≤ K, `--min K` for x ≥ K) at about 2 NAND gates per input bit, with K built into the gates. Each circuit file records the exact command that produced it.
- **Verification:** every netlist is loaded and evaluated with the TAP-02 reference evaluator ([vendored unmodified](./contracts/tapeout/vendor/README.md)) and checked against plain integer comparison for every possible input before the file is written.
- **Saturation, not truncation:** the guardian computes signals at full width, and [`TapeOutSignal.encode`](./contracts/src/libraries/TapeOutSignal.sol) caps each one at the circuit's all-ones input. Truncating instead would let 655.37x leverage (65537) reach a 16-bit circuit as 1 and pass. The generator refuses a ceiling of 65535 or more, so capping never changes a verdict.

### B. The guardian on real circuits
- **Contract:** [`TapeOutCircuitGuardian.sol`](./contracts/src/core/TapeOutCircuitGuardian.sol). `setCircuit(check, processor, circuitId)` accepts only processors the TapeOut factory reports as its own (`isCPU`), with one output and no latch state; the input width is read from `circuitInfo`.
- **Verdict:** each check whose circuit outputs 0 sets its diagnostic bit (leverage=1, slippage=2, drawdown=4, cooldown=8); the trade passes only when all four output 1.
- **Fails loudly:** with no circuits set the guardian is inactive; with one to three set every trade reverts `IncompleteCircuitSet`, so a half-configured gate cannot silently skip a check.
- **Vault hook:** [`ViperVault.sol`](./contracts/src/core/ViperVault.sol) — `openPosition()` runs the guardian for every direct trade, so `/trade` UI trades are gated. It is skipped when the caller is an authorized `PositionRouter`, which runs the guardian itself, so one trade is never counted twice against the cooldown.
- **Router hook:** [`PositionRouter.sol`](./contracts/src/core/PositionRouter.sol) runs the guardian on every signed EIP-712 agent intent before execution.
- **Direct trades name no limit price**, so they report zero slippage rather than a fabricated value; drawdown is set per agent by the router or owner.
- **Market config:** the vault's per-market cap is the leverage circuit's ceiling + 5x (25x), so the circuit is the binding limit: a 22x trade is rejected by the circuit (`CircuitRiskRejected(1)`), not by the vault.

### C. Deploy path (X Layer mainnet, full stack)
The vault must live on the same chain as the circuits it calls, and TapeOut exists only on mainnet, so the whole stack moves to mainnet. [`deploy-xlayer-stack.sh`](./contracts/script/deploy-xlayer-stack.sh) runs three scripts in order. Before each one it simulates the step and shows the estimate, then asks to broadcast:

1. [`TapeOutRiskCircuits.s.sol`](./contracts/script/TapeOutRiskCircuits.s.sol) creates one processor through the factory, mints the 158 NAND gates and tapes out the four circuits.
2. [`DeployMockOracleXLayer.s.sol`](./contracts/script/DeployMockOracleXLayer.s.sol) deploys the demo collateral (MockUSDC with a public faucet), a MockPyth set to live prices, and the price adapter.
3. [`DeployVaultWithCircuitXLayer.s.sol`](./contracts/script/DeployVaultWithCircuitXLayer.s.sol) deploys the vault, router and guardian. It wires the four circuits through [`TapeOutWiring.sol`](./contracts/script/TapeOutWiring.sol), which refuses any circuit whose on-chain netlist differs from its generated file, then adds the markets from [`xlayer-markets.json`](./contracts/config/xlayer-markets.json) and seeds liquidity.

Fees, gas price and market prices are read live. [`simulate-xlayer-stack.sh`](./contracts/script/simulate-xlayer-stack.sh) runs the same deploy on a local mainnet fork funded with the planned amounts only. It then trades once at 5x, which passes, and once above the ceiling, which the leverage circuit rejects. It was broadcast to mainnet on 2026-11-16 (addresses in §4); steps are in [`docs/TAPEOUT_MAINNET_RUNBOOK.md`](./docs/TAPEOUT_MAINNET_RUNBOOK.md).

**Measured cost** (mainnet fork, 2026-11-16, 0.02 gwei):

| Item | Cost |
| :--- | :--- |
| BEM | 0.11 (processor 0.10 + gate mint 0.01) |
| OKB fees | 4 × 0.0013 per tape-out |
| Gas, whole stack | 12.4M (0.00025 OKB) |
| **OKB total** | **≈ 0.0054** |
| Gated `openPosition` (four real `eval` calls) | 805k gas |
| Each `eval` | ≈ 99–110k gas |

### D. TapeOut DeWEB Package (TAP-10)
- **Build Script:** [`scripts/build-deweb.ts`](./scripts/build-deweb.ts) (`bun run build:deweb`)
- **Static Artifact:** [`dist-deweb/index.html`](./dist-deweb/index.html) — self-contained portal reading directly from X Layer RPC
- **SHA-256 of `index.html` (19,403 bytes):** `2f7c1c338e156a0f59f65b3823402cebcd96a67734ee063d73e0ea9934d0b857`
- **TAP-10 Manifest:** [`dist-deweb/deweb.manifest.json`](./dist-deweb/deweb.manifest.json) — **stale**: it records an older hash and the placeholder name `tape://viperx.tape`.
- **Interactive Circuit Simulator:** lets judges toggle the four check inputs and watch the verdict.
- **Not done:** the portal still describes the testnet processor in §4, and the package has not been published on DeWEB. Rebuild after the mainnet tape-out.

---

## 3. Circuit Architecture

```
  trade (size, collateral, limit price, agent)
        |
        v
  TapeOutCircuitGuardian.computeSignals         full-width integers
        |  leverage x100 | slippage bps | drawdown bps | seconds since last trade
        v
  TapeOutSignal.encode(value, nIn)              saturate to 2^nIn - 1, pack LSB-first
        |
        +--> processor.eval(leverage_le) --> 1 = pass / 0 = fail --> diag bit 0
        +--> processor.eval(slippage_le) --> 1 = pass / 0 = fail --> diag bit 1
        +--> processor.eval(drawdown_le) --> 1 = pass / 0 = fail --> diag bit 2
        +--> processor.eval(cooldown_ge) --> 1 = pass / 0 = fail --> diag bit 3
        |
        v
  passed = (diagnosticBits == 0)   else revert CircuitRiskRejected(diagnosticBits)

  Each circuit: a chain of ~2 NAND gates per input bit comparing x against a constant
  built into the netlist (x <= K scanned LSB to MSB; x >= K as NOT(x <= K-1)).

  Call paths:
    /trade UI  --> ViperVault.openPosition()            --> Guardian --> 4 x eval
    AI agent   --> PositionRouter.executeAgentIntent()  --> Guardian --> 4 x eval
                                                        --> ViperVault (hook skipped)
```

---

## 4. Contracts

### TapeOut protocol (X Layer mainnet, chain 196)

| Contract | Address |
| :--- | :--- |
| TapeOut factory | `0x1f09DAeFA827f02CBb40967cc91b259763760761` |
| DeWEB hub | `0xe61A9C7213a6Aa616C246a2B569e555B417b25ee` |
| ViperX risk processor | [`0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb`](https://www.oklink.com/xlayer/address/0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb) |

### ViperX on X Layer mainnet (chain 196), deployed 2026-11-16

| Contract | Address | Explorer | Deploy tx |
| :--- | :--- | :--- | :--- |
| TapeOut processor “ViperX Risk Guardian” (circuits 1–4) | `0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb` | [OKLink](https://www.oklink.com/xlayer/address/0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb) | [`0x28fca425…`](https://www.oklink.com/xlayer/tx/0x28fca425b94adced7c5da62818a6370590018ae9cc6eba4bcb6ceb79c48a54e9) |
| `ViperVault` | `0x0e36c7fE3B20b1c33B1691E7041A80ad50e77Bdc` | [OKLink](https://www.oklink.com/xlayer/address/0x0e36c7fE3B20b1c33B1691E7041A80ad50e77Bdc) | [`0x32874711…`](https://www.oklink.com/xlayer/tx/0x32874711e119b3b49e0a811d4159e7180207b10409b9421cc3af62856ac0c792) |
| `PositionRouter` | `0x280d21b19A504BDEf95CFd1Aa9492f03EE4e7135` | [OKLink](https://www.oklink.com/xlayer/address/0x280d21b19A504BDEf95CFd1Aa9492f03EE4e7135) | [`0xe56da37f…`](https://www.oklink.com/xlayer/tx/0xe56da37f27bb87746483e1f4ac39ece2a67ed90284697a7c48973e62422feafe) |
| `TapeOutCircuitGuardian` | `0x54FaE0b57646365c6e4631E06dFe3d314BA0206A` | [OKLink](https://www.oklink.com/xlayer/address/0x54FaE0b57646365c6e4631E06dFe3d314BA0206A) | [`0x5709d406…`](https://www.oklink.com/xlayer/tx/0x5709d406fc20ae8ede71d8dabed143b95c58eecd3e20e24833fdef5561d20d9f) |
| `PythPriceAdapter` | `0x3373C0d9A05F1dd87e912b9B7bC010d961aB599b` | [OKLink](https://www.oklink.com/xlayer/address/0x3373C0d9A05F1dd87e912b9B7bC010d961aB599b) | [`0x679f0bbd…`](https://www.oklink.com/xlayer/tx/0x679f0bbd04de50ba97d68d2dbb6b87140343775a4caa6811c31003818918a3b0) |
| `MockUSDC` (Faucet) | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [OKLink](https://www.oklink.com/xlayer/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) | [`0x425d163a…`](https://www.oklink.com/xlayer/tx/0x425d163a0d734d523d0a72a9227facf8ac305e41796bf0a54d0d2c190d98902d) |
| `MockPyth` (Oracle) | `0x68c59b55359Dc36D9E842e7314Da1150a964f4C7` | [OKLink](https://www.oklink.com/xlayer/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7) | [`0x8440f062…`](https://www.oklink.com/xlayer/tx/0x8440f06230f87c38b0b53ec3d08e00ade473eec5e8768c43815c033b14ff0a98) |

| Check | Circuit ID | Passes when |
| :--- | :---: | :--- |
| leverage | 1 | ≤ 20.00x |
| slippage | 2 | ≤ 2.00% |
| drawdown | 3 | ≤ 25.00% |
| cooldown | 4 | ≥ 10 s since the agent's last trade |

Checked on mainnet after the deploy: `vault.circuitGuardian()` is the guardian above, `guardian.circuitFor(0..3)` returns this processor with IDs 1–4, and `processor.eval(1, …)` returns pass for 5x and 20x and fail for 25x.

Vault, router and guardian redeployed 2026-11-17 so positions opened from signed agent intents belong to the agent (`ViperVault.openPositionFor`); before, the vault recorded the router as their trader. Same processor and circuits. Previous addresses: vault [`0x8ad5…3229`](https://www.oklink.com/xlayer/address/0x8ad53FB549707686c1D6484119Fb2D5842A83229), router [`0xEe88…61d6`](https://www.oklink.com/xlayer/address/0xEe8888BDd3d6a2B3F17173773511D151b74961d6), guardian [`0x91d1…40B5`](https://www.oklink.com/xlayer/address/0x91d1aa84A3262B606DCFDb2bcf2da8889c2640B5).

**Proof on mainnet (2026-11-17, ETH-PERP, $1,000 collateral):**

| Trade | Result | Tx |
| :--- | :--- | :--- |
| 5x long | passed all four circuits, position opened (809k gas) | [`0x5ae0f66a…`](https://www.oklink.com/xlayer/tx/0x5ae0f66a42016cc85a035b2ad2b9380ecfd5e17ce9dd40e55b9c03d09e0b35b3) |
| 25x long | reverted `CircuitRiskRejected(1)`: the leverage circuit failed; the vault's own cap is 25x, so only the circuit stopped it | [`0xeffdd924…`](https://www.oklink.com/xlayer/tx/0xeffdd924d113225e32ef6eb8e8c982cba94d00bc5b22b39a76f95c04aafdb632) |

The same two trades on the first mainnet vault (2026-11-16, replaced the next day): [5x passed](https://www.oklink.com/xlayer/tx/0x146510d1aa8449a7752785c8090fde5f28daf98f4ce4341aeb91e7738046d3ed), [25x rejected](https://www.oklink.com/xlayer/tx/0x35170db2344b09f3ff96146ea38a2652e4680e7abbe1b2ed46acaddad73fd094).

Reproduce with [`contracts/script/proof-trade-xlayer.sh`](./contracts/script/proof-trade-xlayer.sh).

### Earlier gate on X Layer testnet (chain 1952) — not a TapeOut circuit

Deployed 2026-11-11; `/trade` moved to the mainnet stack above on 2026-11-16. Its `TapeOutCircuitProcessor` is ViperX's own Solidity comparator contract with a self-defined `evaluateCircuit`; it is **not** a TAP-02 netlist or a TapeOut-factory processor, and the TapeOut factory does not exist on testnet. It is superseded by the circuits above and should not be submitted as the circuit.

| Contract / Asset | Address | Explorer |
| :--- | :--- | :--- |
| `TapeOutCircuitProcessor` (legacy) | `0x5474874Eb3B6945EFEcBeB4041c1b39f4B3918Ff` | [OKLink](https://www.oklink.com/xlayer-test/address/0x5474874Eb3B6945EFEcBeB4041c1b39f4B3918Ff) |
| `TapeOutCircuitGuardian` (legacy) | `0x85F625e8D773f645217298808d9a8edf6D821198` | [OKLink](https://www.oklink.com/xlayer-test/address/0x85F625e8D773f645217298808d9a8edf6D821198) |
| `ViperVault` | `0x347C8ebB8e88B2A556fb9d951469238FE6628501` | [OKLink](https://www.oklink.com/xlayer-test/address/0x347C8ebB8e88B2A556fb9d951469238FE6628501) |
| `PositionRouter` | `0x8C58098B382b982fA78214dB8a10b0374c586932` | [OKLink](https://www.oklink.com/xlayer-test/address/0x8C58098B382b982fA78214dB8a10b0374c586932) |
| `PriceAdapter` | `0xcce8dbdde8a997217CFf51c4A2076f3B9Eb44b70` | [OKLink](https://www.oklink.com/xlayer-test/address/0xcce8dbdde8a997217CFf51c4A2076f3B9Eb44b70) |
| `MockUSDC` | `0x6046c644ea622fBa3043F35d979BAEE83339cfEe` | [OKLink](https://www.oklink.com/xlayer-test/address/0x6046c644ea622fBa3043F35d979BAEE83339cfEe) |

The deployed legacy guardian runs the old source; the guardian in the repo now requires the TapeOut factory and cannot be deployed to testnet.

The frontend reads addresses from env through [`frontend/lib/xlayer.ts`](./frontend/lib/xlayer.ts); see [`frontend/.env.example`](./frontend/.env.example).

---

## 5. Verification & Testing

```bash
cd contracts
forge test                                    # offline: 37 passed, 2 fork suites skipped
set -a; source .env.example; set +a           # sets TAPEOUT_FACTORY_XLAYER
forge test --match-path "test/fork/*" -vv     # mainnet fork: 10 passed
python3 tapeout/gen_comparator.py --name leverage_le --bits 16 --max 2000   # regenerate a circuit
```

**Mainnet fork, real TapeOut processor** ([`GuardianRealCircuits.fork.t.sol`](./contracts/test/fork/GuardianRealCircuits.fork.t.sol)): the four circuits are taped out through the live factory paying its real fees, every minted gate is burned into them, and a ViperVault on the fork is gated by them:
- a 2x trade opens; 22x is rejected by the circuit with bit 1; a re-entry within 10 s with bit 8; 30% drawdown with bit 4;
- 655.37x leverage is saturated and rejected; a processor outside the factory is refused.

**Per-circuit tape-out** ([`TapeOutSpike.fork.t.sol`](./contracts/test/fork/TapeOutSpike.fork.t.sol)): each circuit is taped out alone; the stored netlist, gate count, NFT owner and fees are checked, its test vectors are replayed through `eval` from a contract, and 8 out-of-range values are saturated and checked against integer comparison.

**Offline** — an in-repo TAP-02 evaluator ([`MockTapeOut.sol`](./contracts/src/mocks/MockTapeOut.sol)) runs the same netlist files, after replaying their test vectors:
- [`TapeOutCircuitGuardian.t.sol`](./contracts/test/TapeOutCircuitGuardian.t.sol) — router path: a compliant intent passes; each of the four checks rejects with its own bit; exact boundaries (20.00x passes, 20.01x fails; 25.00% / 25.01%; 9 s / 10 s); all four bits at once; zero collateral counts as unbounded leverage; partial configuration reverts; non-factory processors and multi-output circuits are refused.
- [`ViperVaultCircuitGate.t.sol`](./contracts/test/ViperVaultCircuitGate.t.sol) — direct vault path, including the deployed 25x-cap / 20x-circuit relationship.
- [`TapeOutSignal.t.sol`](./contracts/test/TapeOutSignal.t.sol) — saturation and bit layout, fuzzed.

## 6. Judging Criteria Mapping

The X Layer and TapeOut teams jointly score five criteria (no published weights).

| Criterion | ViperX evidence |
| :--- | :--- |
| **User Value & Commercial Potential** | See below. |
| **Innovation** | Risk limits for autonomous agents enforced by TapeOut NAND circuits in the trade path, not by off-chain policy or Solidity `if`s; the limits are readable from the netlists on chain, and diagnostic bits tell an agent exactly which check it tripped. |
| **Ecosystem Integration** | Four circuits taped out through the TapeOut factory and evaluated with `processor.eval` on every trade; netlists checked with the TAP-02 reference evaluator; DeWEB TAP-10 package. FabX, TapeCode, TapeKit and TapeSend are **not used yet**. |
| **Product Readiness & UX** | Live `/trade` UI on X Layer testnet with 8 markets, gated by the earlier testnet gate; the TapeOut-circuit gate is proven on a mainnet fork and needs the mainnet deploy before the UI uses it. |
| **Demo Video** | ≤ 3 minutes recommended — script in section 7. |

### User value & commercial model
- **Target users:** operators of AI trading agents who need enforceable risk limits, and capital allocators who need to know an agent's record is real (on-chain settled fills, not self-reported PnL).
- **Fees today (on-chain):** 0.10% of size on open and on close, a borrow fee of 0.01%/hour base rate, and a 2.5% liquidation fee split between liquidator and pool. Trading and borrow fees accrue to vault LPs.
- **Why agent operators pay and stay (draft — founder to confirm):** a ViperX track record is the product. Fills are settled on chain and every trade passed four public circuits, so an agent's PnL can be shown to allocators without trusting the operator. The record only grows while the agent keeps trading through ViperX, which is what keeps operators here.
- **Revenue (draft — founder to confirm):**
  - *Protocol share of trading fees* — route a share of the existing 0.10% open/close fee to a treasury. Planned; needs a vault change, not in the contracts today.
  - *Verified-agent listings* — allocators see the full circuit-verified record; operators pay to list an agent on the leaderboard and in the A2A/MCP directory. Planned, off chain.
  - *Circuit licensing through TapeOut* — other builders can reuse the four risk circuits by minting gates from the ViperX processor, at a BEM price per gate set when it is created (`TAPEOUT_MINT_PRICE`). This is native to the protocol, but the price has to be chosen before the mainnet tape-out (runbook: `docs/TAPEOUT_MAINNET_RUNBOOK.md`).

---

## 7. How to Submit

1. **Form:** [OKX Build X / TapeOut Accelerate Google Form](https://forms.gle/EoDNbxQ65dev1wFd9) — before December 7, 2026, 23:59 UTC (provisional).
2. **Project Name:** ViperX (TapeOut Circuit Guardian & DeWEB)
3. **Category:** Circuit Design + Apps & Tools on X Layer
4. **Processor contract address:** `0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb` (X Layer mainnet). Not the testnet `0x5474874E…`, which is not a TapeOut processor.
5. **Circuit IDs:** `1, 2, 3, 4` — leverage, slippage, drawdown, cooldown. Confirm the form accepts more than one ID, or submit the leverage circuit and list the rest in the summary.
6. **Access link:** [https://www.viperx.site/](https://www.viperx.site/) and the DeWEB address once the package is published (`tape://viperx.tape` is a placeholder, not a published name)
7. **TapeOut features used:** four taped-out circuits evaluated in the trade path, DeWEB TAP-10.
8. **New Development Summary:**
   > *"Designed four TapeOut NAND circuits — leverage, slippage, drawdown and anti-wash cooldown — generated and checked against the TAP-02 reference evaluator for every input, and taped them out to a TapeOut processor on X Layer. Every ViperX trade, from the UI or from a signed agent intent, is evaluated by all four circuits with processor.eval before it reaches vault liquidity, and a rejection says which check failed. Packaged the verification portal and a circuit simulator for TapeOut DeWEB (TAP-10)."*
9. **Demo Video (2:29):** [https://youtu.be/LRdL7g3I2Ao](https://youtu.be/LRdL7g3I2Ao) (unlisted). Planned outline, as recorded:
   1. The problem: unverified AI trading agents and uncontrolled risk.
   2. The four netlists: how a comparator is built from NAND gates, and where the limits live.
   3. Trades gated by the circuits on `/trade`: a 5x trade passes; at **25x** (the vault allows it, and the 20x leverage circuit does not) the order is refused as *"blocked by the on-chain risk circuits: leverage check failed"*, from `CircuitRiskRejected(1)`. The **Circuits** button shows which processor and circuits are live.
   4. The DeWEB portal and circuit simulator.
