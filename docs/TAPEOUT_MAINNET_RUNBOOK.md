# X Layer mainnet deploy — runbook

Puts the whole ViperX stack on X Layer mainnet (chain 196) so `/trade` is gated by the four real TapeOut circuits:

1. **Tape-out** (`TapeOutRiskCircuits.s.sol`): one processor and the four risk circuits.
2. **Collateral and oracle** (`DeployMockOracleXLayer.s.sol`): MockUSDC with a public faucet, MockPyth set to live prices, and the PythPriceAdapter.
3. **Vault** (`DeployVaultWithCircuitXLayer.s.sol`): the vault, the router, and the guardian wired to the four circuits. It adds the eight markets from `contracts/config/xlayer-markets.json` and seeds LP liquidity.

`contracts/script/deploy-xlayer-stack.sh` runs the three steps in order. Before each one it simulates the step and prints the estimate, and it broadcasts only after you type `y`. It writes every address to `contracts/deployments/xlayer-196.env` and skips steps already recorded there, so a failed run resumes without paying the tape-out fees twice. Gas price, BEM and OKB fees, and market prices are all read live when it runs.

## 1. Fund the deployer

Deployer: `0x9f718b338Ccc69B6AC211Dc8239548E43095813a` (keystore `viperx-deployer`; confirm with `cast wallet address --account viperx-deployer`). On 2026-11-16 it held nothing on X Layer or BNB Chain.

Minimum funding, measured 2026-11-16. The fork run in step 3 passed with exactly 0.01 OKB and 0.11 BEM.

| Send to the deployer | Amount | Covers |
| :--- | ---: | :--- |
| BEM on BNB Chain | **0.112** | 0.11 for the deploy (0.10 factory `deployFee()` + 0.01 gate-mint fee). Plus the bridge's 0.5% fee (0.00056) and 0.001 spare |
| BNB on BNB Chain | **0.0025** | Bridge fee 0.00203 (LayerZero, quoted live), approve and send gas (~300k at 0.05 gwei, ≈0.00002), and spare |
| OKB on X Layer | **0.01** | Deploy ≈0.0055 (4 × 0.0013 tape-out fees + 12.4M gas at 0.02 gwei). The rest pays for ~280 gated trades at 805k gas each |

- **Getting BEM.** It trades on PancakeSwap (BNB Chain), with BEM/USDT and BEM/WBNB pools of roughly $55k–140k liquidity at ~$10.2 on 2026-11-16. A 0.112 BEM buy (~$1.15) won't move the price. Buy it in your own wallet and send it to the deployer, or send extra BNB and swap.
- **Withdrawal minimums.** Exchange minimums for OKB to X Layer and BNB to BNB Chain may be above these amounts. Anything extra stays in the deployer.
- **Gas for trading.** A wallet that trades in the demo needs its own OKB on X Layer, unless it is the deployer.

Then bridge the BEM to X Layer. `script/bridge-bem.sh` reads the adapter's fee live and sends just enough for the requested amount to arrive. The `minAmountLD` it sets makes the bridge revert rather than deliver less. Run it without `--send` to see the quote; it needs `BSC_RPC_URL`, `BEM_BSC_ADAPTER` and `BEM_XLAYER_EID` from `.env.example`.

```bash
cd contracts && set -a && source .env && set +a && ./script/bridge-bem.sh 0.111
```

```bash
cd contracts && set -a && source .env && set +a && ./script/bridge-bem.sh 0.111 --send -- --account viperx-deployer
```

Delivery takes a few minutes (track it on layerzeroscan.com). Check it arrived (`11100000` = 0.111 BEM):

```bash
cast call 0x60e62Efa9405d6873C5deaBD4E6CC91c25363952 'balanceOf(address)(uint256)' 0x9f718b338Ccc69B6AC211Dc8239548E43095813a --rpc-url https://rpc.xlayer.tech
```

### Optional: DeWEB site (+0.08 OKB)

Publishing the portal on DeWEB means opening the container of one of the circuits. `open(processor, #ID)` on the X Layer container opener (`0x536adD8F30f03b69f6fbF29d425A816A0dC50106`) charges its `FEE()`. That fee is **0.08 OKB**, confirmed on a fork on 2026-11-16: anything less reverts. The opening is one-time, and anyone may open a container.

- X Layer's `DomainBinding.monthlyFee()` is 0.
- `index.html` (19 KB) fits in one `putFile` call.
- Gas for both steps is under 0.0002 OKB.

Opening a container costs roughly 15 times the whole OKB for the deploy. Skip it to keep the cost minimal, or add 0.08 OKB for the Ecosystem Integration criterion. Not scripted yet.

## 2. Settings

Put these in `contracts/.env` (see `contracts/.env.example`):

- **`TAPEOUT_CPU_NAME`, `TAPEOUT_CPU_SYMBOL`, `TAPEOUT_CPU_STORY`.** These are public and stay on chain for good.
- **`TAPEOUT_MINT_PRICE`.** The BEM per gate other builders pay to mint gates from this processor. It is passed to `createCPU`; the transistors contract is a beacon proxy, and I could not confirm a setter exists, so treat it as fixed. It defaults to 0. See the revenue model in TAPEOUT_HACKATHON.md section 6.
- **Fixed values:**
  - `DEPLOYER_ADDRESS=0x9f718b338Ccc69B6AC211Dc8239548E43095813a`
  - `TAPEOUT_FACTORY_XLAYER`
  - `OKX_TICKER_API_URL`
  - `YAHOO_CHART_API_URL`

Market caps, minimum sizes, the oracle confidence limit and the $500k LP seed are in `contracts/config/xlayer-markets.json`.

## 3. Simulate (no funds, no key)

This runs the exact deploy on a local anvil fork of mainnet, funded with only what lands on X Layer (0.01 OKB, 0.11 BEM). It then makes one 5x trade, which must pass, and one trade above the leverage ceiling, which the circuit must reject. Finally it prints the real cost at today's gas price. Broadcast records go to a temp dir, so nothing in `broadcast/` looks like a mainnet deploy.

```bash
cd contracts && set -a && source .env && set +a && ./script/simulate-xlayer-stack.sh 0.01 0.11
```

Result on 2026-11-16, at 0.02 gwei, with 0.01 OKB and 0.11 BEM (0.0046 OKB and 0 BEM left):

| | |
| :--- | ---: |
| Gas, all three steps | 12.4M (0.00025 OKB) |
| TapeOut fees, 4 × `TAPEOUT_FEE()` | 0.0052 OKB |
| **OKB total** | **0.0054** |
| BEM | 0.11 |
| One gated trade (4 real `processor.eval` calls) | 805k gas (0.000016 OKB) |
| 22x trade | rejected by the leverage circuit |

forge's own "Estimated amount required" line counts gas only; the TapeOut fees come on top.

## 4. Deploy

```bash
cd contracts && set -a && source .env && set +a && ./script/deploy-xlayer-stack.sh --rpc-url xlayer_mainnet -- --account viperx-deployer
```

It asks for the keystore password once per step. At the end it prints:

- the full address list, also saved in `contracts/deployments/xlayer-196.env`
- a ready-to-paste frontend block

## 5. Switch the frontend

In `frontend/.env.local` and in the hosting provider's env:

1. Replace the testnet block with the mainnet block from `frontend/.env.example`.
2. Fill in the printed values.

The mainnet block sets:

- `NEXT_PUBLIC_XLAYER_NETWORK_NAME=OKX X Layer`
- `NEXT_PUBLIC_XLAYER_EXPLORER=https://www.oklink.com/xlayer`
- `NEXT_PUBLIC_XLAYER_TESTNET=false`
- the four `NEXT_PUBLIC_XLAYER_CIRCUIT_ID_*`

The app throws on a missing variable, so the hosting provider must have all of them before the next deploy.

## 6. Record

Put the processor address and the four circuit IDs, plus the vault, router and guardian addresses, in:

- TAPEOUT_HACKATHON.md section 7
- DEPLOYED.md
- the README contracts table

## Keeping prices current

MockPyth prices don't move by themselves. To move them back to live prices:

```bash
cd contracts && set -a && source .env && source deployments/xlayer-196.env && set +a && ./script/fetch-mock-prices.sh && forge script script/RefreshMockPricesXLayer.s.sol --rpc-url xlayer_mainnet --account viperx-deployer --sender $DEPLOYER_ADDRESS --legacy --broadcast
```
