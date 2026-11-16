# ViperX Deployed Contracts & Live Protocol Addresses

**Deployer / Admin**: [`0x9f718b338Ccc69B6AC211Dc8239548E43095813a`](https://www.oklink.com/xlayer/address/0x9f718b338Ccc69B6AC211Dc8239548E43095813a)  
**Deployment Date**: X Layer mainnet 2026-11-16; earlier testnets August 28, 2026  

---

## 0. OKX X Layer Mainnet (Chain ID 196) — TapeOut Accelerate

The live `/trade` stack. Every trade is evaluated by four TapeOut NAND circuits on the processor below before it reaches the vault.

| Contract | Address | Explorer | Deploy tx |
| :--- | :--- | :--- | :--- |
| TapeOut processor “ViperX Risk Guardian” (circuits 1–4) | `0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb` | [OKLink](https://www.oklink.com/xlayer/address/0xb57b56034e2dc25161e2512CfC40b24EA3bee1Fb) | [`0x28fca425…`](https://www.oklink.com/xlayer/tx/0x28fca425b94adced7c5da62818a6370590018ae9cc6eba4bcb6ceb79c48a54e9) |
| `ViperVault` | `0x8ad53FB549707686c1D6484119Fb2D5842A83229` | [OKLink](https://www.oklink.com/xlayer/address/0x8ad53FB549707686c1D6484119Fb2D5842A83229) | [`0xce5ed47b…`](https://www.oklink.com/xlayer/tx/0xce5ed47b1fcd1c9881d617f0ca52b73dc41f23b8a245a93a029f192febe90eaf) |
| `PositionRouter` | `0xEe8888BDd3d6a2B3F17173773511D151b74961d6` | [OKLink](https://www.oklink.com/xlayer/address/0xEe8888BDd3d6a2B3F17173773511D151b74961d6) | [`0x6789ae12…`](https://www.oklink.com/xlayer/tx/0x6789ae12987a848bf81ddab4841919c472dfdbdb40975539e6cbcb39343302ef) |
| `TapeOutCircuitGuardian` | `0x91d1aa84A3262B606DCFDb2bcf2da8889c2640B5` | [OKLink](https://www.oklink.com/xlayer/address/0x91d1aa84A3262B606DCFDb2bcf2da8889c2640B5) | [`0x5d90486f…`](https://www.oklink.com/xlayer/tx/0x5d90486f5d44b8b06b806da4715162050a4bdcc655a80b75204f17dc0052070a) |
| `PythPriceAdapter` | `0x3373C0d9A05F1dd87e912b9B7bC010d961aB599b` | [OKLink](https://www.oklink.com/xlayer/address/0x3373C0d9A05F1dd87e912b9B7bC010d961aB599b) | [`0x679f0bbd…`](https://www.oklink.com/xlayer/tx/0x679f0bbd04de50ba97d68d2dbb6b87140343775a4caa6811c31003818918a3b0) |
| `MockUSDC` (Faucet) | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [OKLink](https://www.oklink.com/xlayer/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) | [`0x425d163a…`](https://www.oklink.com/xlayer/tx/0x425d163a0d734d523d0a72a9227facf8ac305e41796bf0a54d0d2c190d98902d) |
| `MockPyth` (Oracle) | `0x68c59b55359Dc36D9E842e7314Da1150a964f4C7` | [OKLink](https://www.oklink.com/xlayer/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7) | [`0x8440f062…`](https://www.oklink.com/xlayer/tx/0x8440f06230f87c38b0b53ec3d08e00ade473eec5e8768c43815c033b14ff0a98) |

| Check | Circuit ID | Passes when |
| :--- | :---: | :--- |
| leverage | 1 | ≤ 20.00x |
| slippage | 2 | ≤ 2.00% |
| drawdown | 3 | ≤ 25.00% |
| cooldown | 4 | ≥ 10 s since the agent's last trade |

---

## 1. OKX X Layer Testnet (Chain ID 1952)

*OKX Dev Day 2026 Primary Deployment*

| Contract | Explorer | Address on X Layer Testnet | Deployment Tx Hash |
| :--- | :--- | :--- | :--- |
| **`ViperVault`** | [View Explorer](https://www.oklink.com/xlayer-test/address/0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89) | `0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89` | [`0x0d3245fc...`](https://www.oklink.com/xlayer-test/tx/0x0d3245fc99837df8ad686dbc99ac7dbeabc4383972578e5035c69e5cff56e354) |
| **`PositionRouter`** | [View Explorer](https://www.oklink.com/xlayer-test/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [`0x441771a4...`](https://www.oklink.com/xlayer-test/tx/0x441771a4509fd57e25f5fc947c8e43a296e7462894ff4edca7963700b626b30c) |
| **`PythPriceAdapter`** | [View Explorer](https://www.oklink.com/xlayer-test/address/0xb268300045a4dE15c1842c179CD4CFF81387c723) | `0xb268300045a4dE15c1842c179CD4CFF81387c723` | [`0x3d062837...`](https://www.oklink.com/xlayer-test/address/0xb268300045a4dE15c1842c179CD4CFF81387c723) |
| **`MockUSDC` (Faucet)** | [View Explorer](https://www.oklink.com/xlayer-test/address/0x6046c644ea622fBa3043F35d979BAEE83339cfEe) | `0x6046c644ea622fBa3043F35d979BAEE83339cfEe` | [`0x8ab4470a...`](https://www.oklink.com/xlayer-test/tx/0x8ab4470a145bf343d9cbba788d183367df5792013ec9181d1a9bea010ab8b541) |
| **`MockPyth` (Oracle)** | [View Explorer](https://www.oklink.com/xlayer-test/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee) | `0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee` | [`0x465de4c4...`](https://www.oklink.com/xlayer-test/tx/0x465de4c4d54ed4a90947c411e82f72ef6575aea38e51aebe23c41d7e376ebc6c) |

### Initialized Perpetual Markets (OKX X Layer Testnet)

| Market | Market ID (Keccak-256) | Feed ID | Max OI (Long / Short) | Max Leverage | Min Position Size |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **ETH-PERP** | `keccak256("ETH-PERP")` | `0xff61491a...` | $1,000,000 / $1,000,000 | 5x (20% margin) | $10.00 |
| **BTC-PERP** | `keccak256("BTC-PERP")` | `0xe62df6e8...` | $2,000,000 / $2,000,000 | 5x (20% margin) | $20.00 |
| **SOL-PERP** | `keccak256("SOL-PERP")` | `0xef0d8b6f...` | $500,000 / $500,000 | 5x (20% margin) | $5.00 |
| **OKB-PERP** *(OKX Native)* | `keccak256("OKB-PERP")` | `keccak256("OKB-USD-FEED")` | $500,000 / $500,000 | 5x (20% margin) | $5.00 |
| **NVDA-PERP** *(RWA)* | `keccak256("NVDA-PERP")` | `0x5a54e99f...` | $500,000 / $500,000 | 5x (20% margin) | $10.00 |
| **TSLA-PERP** *(RWA)* | `keccak256("TSLA-PERP")` | `0x16093414...` | $500,000 / $500,000 | 5x (20% margin) | $10.00 |
| **COIN-PERP** *(RWA)* | `keccak256("COIN-PERP")` | `0x19d554a9...` | $500,000 / $500,000 | 5x (20% margin) | $10.00 |
| **SPY-PERP** *(RWA)* | `keccak256("SPY-PERP")` | `0x2613da66...` | $1,000,000 / $1,000,000 | 5x (20% margin) | $20.00 |

*Initial Liquidity Seeded:* **$500,000 USDC** in `ViperVault`.

---

## 2. Base Sepolia (Chain ID 84532)

*Secondary EVM deployment*

| Contract | BaseScan Explorer | Address on Base Sepolia | Deployment Tx Hash |
| :--- | :--- | :--- | :--- |
| **`ViperVault`** | [View on BaseScan](https://sepolia.basescan.org/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7) | `0x68c59b55359Dc36D9E842e7314Da1150a964f4C7` | [`0x23d791bf...`](https://sepolia.basescan.org/tx/0x23d791bf51fe4e17f2f13b24e90c47aaa1ecc7e706b404f7274e518ebca63552) |
| **`PositionRouter`** | [View on BaseScan](https://sepolia.basescan.org/address/0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F) | `0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F` | [`0x1186d86d...`](https://sepolia.basescan.org/tx/0x1186d86dc46f618690dbc5d662bd171474b93dc1e44f2cd47a95fdd00ea91db9) |
| **`PythPriceAdapter`** | [View on BaseScan](https://sepolia.basescan.org/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [`0x870238a4...`](https://sepolia.basescan.org/tx/0x870238a4a2b1df0ae59abab5e6801832efb18965294412df97aba93d969df018) |
| **Official USDC** | [View on BaseScan](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | *Circle Testnet Contract* |
| **Pyth Oracle Contract** | [View on BaseScan](https://sepolia.basescan.org/address/0xA2aa501b19aff244D90cc15a4Cf739D2725B5729) | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` | *Pyth Network Endpoint* |

### Initialized Perpetual Markets (Base Sepolia)

| Market | Market ID (Keccak-256) | Pyth Feed ID | Max OI (Long / Short) | Max Leverage | Min Position Size |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **ETH-PERP** | `keccak256("ETH-PERP")` | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` | $500,000 / $500,000 | 5x (20% margin) | $10.00 |
| **BTC-PERP** | `keccak256("BTC-PERP")` | `0xe62df6e875746b43f8000b0b152753545192ddc4203240d23e1112c0200ecd92` | $1,000,000 / $1,000,000 | 5x (20% margin) | $20.00 |
| **SOL-PERP** | `keccak256("SOL-PERP")` | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` | $250,000 / $250,000 | 5x (20% margin) | $5.00 |

---

## 3. TapeOut Circuit Guardian & DeWEB (OKX X Layer)

*TapeOut Accelerate Hackathon Deployments*

| Component | Standard / ID | Details / Hash | Explorer Link |
| :--- | :--- | :--- | :--- |
| **TapeOut Circuit Guardian** | Circuit ID: `101` (`VIPERX_RISK_V1`) | Hardware-grade 256-bit combinational risk gate | Integrated in [`PositionRouter`](https://www.oklink.com/xlayer-test/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) |
| **TapeOut DeWEB Package** | TAP-10 Protocol | SHA-256: `d166da796e1b5963da84d081e529707b6d1b0e9d39c880ea8077241df11c215d` | [`tape://viperx.tape`](./dist-deweb/deweb.manifest.json) |
