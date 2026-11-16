# X Layer mainnet deploy — runbook

Puts the whole ViperX stack on X Layer mainnet (chain 196) so `/trade` is gated by the four real TapeOut circuits:

1. **Tape-out** (`TapeOutRiskCircuits.s.sol`): one processor and the four risk circuits.
2. **Collateral and oracle** (`DeployMockOracleXLayer.s.sol`): MockUSDC with a public faucet, MockPyth set to live prices, and the PythPriceAdapter.
3. **Vault** (`DeployVaultWithCircuitXLayer.s.sol`): the vault, the router, and the guardian wired to the four circuits. It adds the eight markets from `contracts/config/xlayer-markets.json` and seeds LP liquidity.

`contracts/script/deploy-xlayer-stack.sh` runs the three steps in order. Before each one it simulates the step and prints the estimate, and it broadcasts only after you type `y`. It writes every address to `contracts/deployments/xlayer-196.env` and skips steps already recorded there, so a failed run resumes without paying the tape-out fees twice. Gas price, BEM and OKB fees, and market prices are all read live when it runs.

## 1. Fund the deployer

Deployer: `0x9f718b338Ccc69B6AC211Dc8239548E43095813a` (keystore `viperx-deployer` — confirm with `cast wallet address --account viperx-deployer`). On 2026-11-16 it held nothing on X Layer or BNB Chain.

- [ ] **0.12 BEM on BNB Chain** to the deployer. Needed: 0.11, which is the factory `deployFee()` (0.10) plus the gate-mint protocol fee (0.01).
- [ ] **~0.003 BNB on BNB Chain** to the deployer, for the bridge fee (~0.002, quoted live below) and gas.
- [ ] **0.02 OKB on X Layer** to the deployer. Withdraw from OKX on the "X Layer" network. Needed: ~0.0055 for the deploy. The rest covers hundreds of demo trades at 805k gas each.

Then bridge the BEM to X Layer, signed by the deployer. BEM is a LayerZero OFT: the BNB-side adapter locks it and the X Layer OFT mints it.

| | Address |
| :--- | :--- |
| BEM, BNB Chain (8 decimals) | `0x5ce033B2bFCa3Af30b3e8C8457DeaF776A8b695a` |
| OFT adapter, BNB Chain | `0xa84b8d3893de6e9922f2b29be1e1b115845f5e72` |
| BEM OFT, X Layer | `0x60e62Efa9405d6873C5deaBD4E6CC91c25363952` (the factory's `bem()`) |
| LayerZero eid, X Layer | `30274` |

```bash
BSC=https://bsc-dataseed.bnbchain.org; ADAPTER=0xa84b8d3893de6e9922f2b29be1e1b115845f5e72; D=0x9f718b338Ccc69B6AC211Dc8239548E43095813a
PARAM="(30274,0x000000000000000000000000${D:2},12000000,12000000,0x,0x,0x)"
FEE=$(cast call $ADAPTER 'quoteSend((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),bool)((uint256,uint256))' "$PARAM" false --rpc-url $BSC | tr -d '()' | cut -d' ' -f1); echo "bridge fee: $(cast from-wei $FEE) BNB"
```

```bash
cast send 0x5ce033B2bFCa3Af30b3e8C8457DeaF776A8b695a 'approve(address,uint256)' $ADAPTER 12000000 --rpc-url $BSC --account viperx-deployer
```

```bash
cast send $ADAPTER 'send((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),(uint256,uint256),address)' "$PARAM" "($FEE,0)" $D --value $FEE --rpc-url $BSC --account viperx-deployer
```

Delivery takes a few minutes (track it on layerzeroscan.com). Check it arrived; `12000000` means 0.12 BEM:

```bash
cast call 0x60e62Efa9405d6873C5deaBD4E6CC91c25363952 'balanceOf(address)(uint256)' 0x9f718b338Ccc69B6AC211Dc8239548E43095813a --rpc-url https://rpc.xlayer.tech
```

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

This runs the exact deploy on a local anvil fork of mainnet, funded with only the amounts above. It then makes one 5x trade, which must pass, and one trade above the leverage ceiling, which the circuit must reject. Finally it prints the real cost at today's gas price. Broadcast records go to a temp dir, so nothing in `broadcast/` looks like a mainnet deploy.

```bash
cd contracts && set -a && source .env && set +a && ./script/simulate-xlayer-stack.sh 0.02 0.12
```

Result on 2026-11-16, at 0.02 gwei:

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
