# ViperX Dual-Chain Perp Engine & Protocol Roadmap

**Document Version**: 1.0.0  
**Target Chains**: Base (EVM) + Solana (SVM)  
**Architecture Model**: Oracle + Shared Liquidity Pool (GMX / JLP / Adrena Style)  
**Status**: Strategic Architecture & Implementation Blueprint  

---

## 1. Vision & Strategy

ViperX combines **Autonomous AI Trading Agents** with **Native On-Chain Perpetual Liquidity**.

Rather than attempting to build an ultra-complex central limit order book (CLOB) on Day 1—which demands millions in market-maker capital and low-latency infrastructure—ViperX follows the battle-tested **Oracle + Shared Liquidity Pool** architecture:

```
                          ┌───────────────────────────┐
                          │   ViperX Front-End / Hub  │
                          └─────────────┬─────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         │   ViperX Execution Runtime  │
                         └──────┬───────────────┬──────┘
                                │               │
                ┌───────────────▼─────┐   ┌─────▼───────────────┐
                │   Base (EVM)        │   │   Solana (SVM)      │
                │   ViperPerp.sol     │   │   viperx_perpetuals │
                │   • ETH-PERP / USDC │   │   • SOL-PERP / USDC │
                │   • SOL-PERP / USDC │   │   • Pyth Solana SDK │
                │   • Pyth EVM SDK    │   │   • Non-Custodial   │
                └───────────────┬─────┘   └─────┬───────────────┘
                                │               │
                                └───────┬───────┘
                                        ▼
                         ┌─────────────────────────────┐
                         │   PnL & Sharpe Indexer DB   │
                         │   Cross-Chain Leaderboard   │
                         └─────────────────────────────┘
```

---

## 2. The 6 Core Subsystems

Every trade in the ViperX Perp Engine is governed by 6 interconnected components:

1. **Collateral & LP Vault (`ViperPool`)**:
   - Liquidity Providers (LPs) deposit `USDC` to act as the counterparty to all traders/agents.
   - LPs earn borrow fees, trading fees, and liquidation penalties.
2. **Position Accounting**:
   - Tracks `side` (Long/Short), `size_usd`, `collateral_usd`, `entry_price`, `entry_funding_index`, and `last_updated_at`.
3. **Oracle Pricing**:
   - Integrated with **Pyth Network** on both Base and Solana.
   - Strict sanity checks: price staleness (< 20 seconds) and confidence interval bounds.
4. **Execution & Margin Math**:
   - Zero price slippage for small/medium sizes against the oracle mark price.
   - Maximum leverage capped at **5x – 10x** to protect the LP pool from flash drawdowns.
5. **Funding & Borrow Rate Crank**:
   - Dynamic hourly borrow rate based on pool utilization (`utilization = open_interest / total_pool_usd`).
   - Funding payments balance long vs. short skew.
6. **Liquidations & Insurance Fund**:
   - Automated keeper bots liquidate positions when `margin_ratio < maintenance_margin` (e.g., 5%).
   - Protocol liquidation fee splits between keeper bounty and the Insurance Fund.

---

## 3. Dual-Chain Implementation Plan

### Track A: Base (EVM / Solidity / Foundry)
*Why Base first*: Mature open-source reference codebases (GMX v1), instant Foundry testing, sub-cent gas fees, and native Pyth feeds.

- **Contracts**:
  - `ViperVault.sol`: Handles USDC deposits, withdrawals, and pool NAV.
  - `PositionRouter.sol`: Manages position opens, closes, and stop-loss/take-profit limits.
  - `PythPriceAdapter.sol`: Fetches and validates Pyth oracle price streams.
  - `ViperLiquidator.sol`: Permissionless liquidation entrypoint with keeper reward incentives.
- **Initial Markets**: `ETH-PERP / USDC`, `SOL-PERP / USDC`, `BTC-PERP / USDC`.

### Track B: Solana (SVM / Rust / Anchor)
*Why Solana*: Ultra-fast sub-second execution, seamless integration with existing ViperX Solana agent PDAs.

- **Anchor Program (`viperx_perpetuals`)**:
  - `Market`: Market configuration, max open interest, fee tiers, and leverage limits.
  - `CustodyPool`: SPL Token account holding USDC liquidity with LP share token mint.
  - `Position`: PDA per `(agent, market, side)` storing collateral and leverage state.
  - `Liquidate`: Permissionless liquidation instruction callable by off-chain cranks.
- **Initial Market**: `SOL-PERP / USDC`.

---

## 4. Phased Roadmap

```
[ Phase A: Current State ]
  ├── Non-custodial Agent Registry & PDA delegation live on Solana & Base.
  ├── Off-chain Execution Runtime trading against devnet/testnet venues.
  └── On-chain verified PnL indexer + Anti-gaming heuristics + Leaderboard.

[ Phase B: Minimal Perp Engine on Devnet / Testnet ]
  ├── Deploy Base Sepolia `ViperVault.sol` (single ETH-PERP market, 5x max leverage).
  ├── Deploy Solana Devnet `viperx_perpetuals` (SOL-PERP market, 5x max leverage).
  ├── Build lightweight Keeper daemon (Funding crank + Liquidation bot).
  └── Build basic LP interface (Deposit USDC / Withdraw USDC / View Pool APY).

[ Phase C: Agent Execution Direct Routing ]
  ├── Connect ViperX Execution Runtime to route agent orders directly into ViperPools.
  ├── Automated on-chain trade settlements with cryptographic transaction verification.
  └── Add Cross-Chain Competition Arena tracking live performance across Base & Solana.

[ Phase D: Mainnet Launch & Scaling ]
  ├── Smart contract security audit (Foundry invariant testing + third-party audit).
  ├── Mainnet LP bootstrap & liquidity mining incentives.
  └── Copy-trading mirrored vault subscriptions with automated performance fee splits.
```

---

## 5. Risk Management & Security Guardrails

To prevent the most common failure modes in on-chain perps, ViperX will enforce the following invariant rules:

1. **Max Leverage Cap (5x–10x)**: Eliminates oracle latency arbitrage and prevents bad-debt cascades.
2. **Pyth Oracle Staleness Filter**: Reject any transaction where the Pyth price is older than 20 seconds or where the confidence interval exceeds 1% of the mark price.
3. **Open Interest (OI) Limits**: Long OI and Short OI cannot exceed 80% of total pool liquidity.
4. **Reserve Factor**: Minimum 20% of pool liquidity locked as non-borrowable buffer for instant user withdrawals.
5. **Circuit Breaker**: Protocol automatically pauses new position openings if oracle price moves > 15% in under 5 minutes.

---

## 6. Development Checklist & Tooling

- **EVM Tooling**: Foundry (`forge`, `cast`), Viem, Pyth EVM SDK.
- **Solana Tooling**: Anchor 0.30+, Solana CLI 1.18+, Pyth Solana SDK.
- **Off-Chain Keepers**: TypeScript / Rust keeper daemon running on Railway / AWS EC2.
- **Testing Standard**: 100% test coverage with fuzz testing on margin math and liquidations before testnet deployment.
