# ViperX Deployed Contracts & Live Protocol Addresses

**Network**: Base Sepolia (Chain ID `84532`)  
**Deployer / Admin**: [`0x9f718b338Ccc69B6AC211Dc8239548E43095813a`](https://sepolia.basescan.org/address/0x9f718b338Ccc69B6AC211Dc8239548E43095813a)  
**Deployment Date**: August 28, 2026  

---

## 🏛️ Base Sepolia Smart Contracts (EVM)

| Contract | Address on Base Sepolia | BaseScan Link | Deployment Tx Hash |
| :--- | :--- | :--- | :--- |
| **`ViperVault`** | `0x68c59b55359Dc36D9E842e7314Da1150a964f4C7` | [View on BaseScan](https://sepolia.basescan.org/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7) | [`0x23d791bf...`](https://sepolia.basescan.org/tx/0x23d791bf51fe4e17f2f13b24e90c47aaa1ecc7e706b404f7274e518ebca63552) |
| **`PositionRouter`** | `0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F` | [View on BaseScan](https://sepolia.basescan.org/address/0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F) | [`0x1186d86d...`](https://sepolia.basescan.org/tx/0x1186d86dc46f618690dbc5d662bd171474b93dc1e44f2cd47a95fdd00ea91db9) |
| **`PythPriceAdapter`** | `0x36B9e0D1b0702FC59114A87f277b836d482EaF6A` | [View on BaseScan](https://sepolia.basescan.org/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A) | [`0x870238a4...`](https://sepolia.basescan.org/tx/0x870238a4a2b1df0ae59abab5e6801832efb18965294412df97aba93d969df018) |

---

## ⚡ Initialized Perpetual Markets

| Market | Market ID (Keccak-256) | Pyth Feed ID | Max OI (Long / Short) | Max Leverage | Min Position Size |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **ETH-PERP** | `keccak256("ETH-PERP")` | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` | $500,000 / $500,000 | 5x (20% margin) | $10.00 |
| **BTC-PERP** | `keccak256("BTC-PERP")` | `0xe62df6e875746b43f8000b0b152753545192ddc4203240d23e1112c0200ecd92` | $1,000,000 / $1,000,000 | 5x (20% margin) | $20.00 |
| **SOL-PERP** | `keccak256("SOL-PERP")` | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` | $250,000 / $250,000 | 5x (20% margin) | $5.00 |

---

## 🔗 External Testnet Dependencies

- **Pyth Oracle Contract (Base Sepolia)**: [`0xA2aa501b19aff244D90cc15a4Cf739D2725B5729`](https://sepolia.basescan.org/address/0xA2aa501b19aff244D90cc15a4Cf739D2725B5729)
- **Official USDC (Base Sepolia)**: [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e)

---

## 🏛️ Solana Devnet Programs (SVM)

| Program | Program ID | Solana Explorer Link |
| :--- | :--- | :--- |
| **`viperx_agent_registry`** | `321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm` | [View on Solana Explorer](https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet) |
| **`viperx_perpetuals`** | `6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED` | [View on Solana Explorer](https://explorer.solana.com/address/6Deo4a3kxfhykzK82ghBrwMY4nHE613Nz9ejb46WFcED?cluster=devnet) |
