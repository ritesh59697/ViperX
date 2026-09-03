# ViperX — Base Batches Application Source of Truth

## One-Liner
ViperX is the on-chain proof layer for AI trading agents on Base. We rank agents on settled USDC fills, not screenshots.

---

## 1. The Problem
Anyone can claim an exceptional AI trading record with cherry-picked screenshots, simulated paper runs, or voluntary off-chain telemetry. Because autonomous trading agents operate as proprietary black boxes, capital allocators have no reliable way to verify whether an agent is genuinely profitable or simply reporting flattering metrics.

Merely logging trades to an on-chain registry does not solve this: agents can self-wash trade or loop micro-transactions to manufacture artificial volume. Without independent verification of settled fills against real collateral and trusted oracle prices, agent leaderboards remain gameable popularity contests.

---

## 2. The Product
ViperX provides an objective on-chain evaluation and proof layer for autonomous trading agents:

- **50-Trade Verification Gate**: Agents must clear 50 closed trades independently corroborated against on-chain position state before earning a rank on the public leaderboard.
- **Anti-Gaming Heuristics**: Automated filters flag sub-10s self-wash trades, enforce a $5 minimum collateral floor to eliminate dust spamming, and detect divergences between self-reported telemetry and on-chain settled PnL.
- **Non-Custodial Smart Vaults**: `ViperVault.sol` keeps capital under owner keys. Delegated agents receive narrow execution rights to submit orders and self-pause—withdrawal permissions never leave the owner's wallet.
- **Risk-Adjusted Scoring**: Ranks agents using volatility-adjusted Sharpe ratios, maximum drawdown penalties, and win-rate consistency across standardized time horizons (24h, 7d, 30d, All Time).

---

## 3. Why Base
- **Native USDC Settlement**: Circle's native USDC on Base eliminates synthetic bridge risk and provides unified dollar accounting across all agent vaults.
- **Sub-Cent Execution**: Ultra-low fees make continuous high-frequency agent evaluation and dynamic position rebalancing economically viable.
- **Coinbase Distribution**: Direct access to Coinbase Smart Wallets and on-chain capital allocators looking for verified, non-custodial quantitative strategies.
- **Ecosystem Gravity**: Base is rapidly becoming the center of gravity for on-chain AI agents and machine-to-machine financial infrastructure.

---

## 4. Honest Traction & Status
- **Testnet Only**: ViperX is currently live on **Base Sepolia testnet** at [https://viper-x-lake.vercel.app](https://viper-x-lake.vercel.app).
- **No Mainnet TVL**: We do not claim production traction. Metrics on the live demo represent testnet evaluation runs.
- **The Core Demo**: The product's key proof point is demonstrating the discrepancy between claimed vs. verified fills—showing how unverified claims and wash trading are actively filtered out while verified on-chain fills earn verified Sharpe rankings.

---

## 5. 8-Week Plan If Selected
- **Weeks 1–2**: Gas optimization and contract hardening for Base mainnet registry, `ViperVault.sol`, and `PositionRouter.sol`; indexer stress testing.
- **Weeks 3–4**: Deploy production Base mainnet registry and `ViperVault` with initial native USDC seed liquidity.
- **Weeks 5–6**: Onboard initial cohort of 20 autonomous quantitative trading agents; activate real-time settlement watcher.
- **Weeks 7–8**: Launch public verified Base Mainnet leaderboard; open vault delegation and performance tracking.

---

## 6. Use of $100K
ViperX is currently an unaudited testnet protocol. The $100K is allocated directly to shipping our Base mainnet production stack and bootstrapping real ecosystem adoption:
- **Base Mainnet Registry**: Gas optimization, contract hardening, and deployment of the on-chain agent registry and routing contracts on Base mainnet.
- **USDC Vault Seed Liquidity**: Initial seed capital in native USDC allocated to non-custodial `ViperVault` to guarantee fill settlement for agent trading loops.
- **Public Verified Leaderboard**: Enterprise indexing infrastructure, failover Postgres clusters, Pyth price feeds, and the real-time public verified leaderboard.
- **First 20 Agents Cohort**: Developer onboarding grants, gas rebates, and integration support to bootstrap the first 20 autonomous quantitative trading agents on Base mainnet.

---

## 7. Explicit Disclaimers
- **Unaudited Testnet**: ViperX is currently live on an unaudited Base Sepolia testnet. We make zero claims of an external audit or mainnet TVL today.
- **No Token**: There is no token in this plan. ViperX is built around non-custodial vault utility, protocol indexing, and performance verification.
- **No Mainnet TVL**: All activity and contracts referenced are operating on Base Sepolia testnet.
- **Multi-Chain Expansion**: Solana is supported as an experimental secondary venue on Devnet; multi-chain expansion will only occur after Base Mainnet is firmly established.

---

**Founder**: Ritesh (@Ritesh5969)  
**Stage**: Pre-seed, solo founder, testnet live
