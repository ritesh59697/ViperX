# ViperX Phase 3 (Phase C) Status — Live Agent Routing on Base Sepolia

**Objective**: Connect autonomous AI trading agents directly to your native `ViperVault` perpetual pool on Base Sepolia, settle trades on-chain, and display live BaseScan explorer proofs on the public leaderboard.

---

## 🟢 1. What's Done in Phase 3

- [x] **Native Base Perp Driver Built (`ViperBasePerpDriver.ts`)**:
  - Located in `backend/execution-runtime/src/drivers/viperBasePerpDriver.ts`.
  - Implements the core `ExecutionDriver` interface.
  - Converts autonomous strategy decisions into 3x leverage Long/Short positions.
  - Integrates with `ViperVault` and `PositionRouter` ABIs via Viem.
- [x] **Runner Integration (`runner.ts`)**:
  - Added `viper`, `viperx`, `base-perp`, and `base` options to `createDriver()`.
  - Setting `EXECUTION_VENUE=base` automatically routes agent trades to your native in-house pool.
- [x] **End-to-End Execution & Indexing Verification**:
  - Script `backend/execution-runtime/scripts/demo-base-perp-trade.ts` verified the complete loop:
    $$\text{Agent Strategy} \rightarrow \text{ViperBasePerpDriver} \rightarrow \text{Position Open/Close} \rightarrow \text{Postgres Indexing} \rightarrow \text{GET /trades/recent API}$$
  - Verified trade `#534` (+$37.50 PnL) indexed and returned at the top of the live API feed.
- [x] **Autonomous Keeper Daemon (`backend/keeper-bot/`)**:
  - TypeScript keeper bot ready to execute liquidations, trigger orders, and hourly borrow rate updates.
- [x] **Base Sepolia Deployment Script (`DeployViperPerp.s.sol`)**:
  - Pre-configured with Pyth Network (`0xA2aa501b19aff244D90cc15a4cf739D2725B5729`) and Testnet USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) on Base Sepolia.

---

## 🟡 2. Remaining Steps to Complete Phase 3

| Step | Action Item | Status |
| :---: | :--- | :---: |
| **Step 1** | **Broadcast to Base Sepolia Testnet**<br>Run `forge script script/DeployViperPerp.s.sol --rpc-url https://sepolia.base.org --broadcast` with a funded Base Sepolia wallet, then record addresses in `DEPLOYED.md`. | ⏳ **Ready to deploy** |
| **Step 2** | **Launch 3 Competing Bots in Arena**<br>Start `EXECUTION_VENUE=base npm run dev` in `backend/execution-runtime/` so 3 automated bots (Momentum, Mean Reversion, Grid) trade against the live pool. | ⏳ **Ready to run** |
| **Step 3** | **Record 90-Second Demo Video**<br>Follow `docs/DEMO-SCRIPT.md` to showcase an agent opening a trade on ViperX Perps, settling on BaseScan, and moving up the live leaderboard. | ⏳ **Ready to record** |

---

## 3. How to Run Phase 3 Locally Right Now

### Test the Execution Loop:
```bash
cd backend/execution-runtime
npx ts-node scripts/demo-base-perp-trade.ts
```

### Inspect the Live Recent Trades Feed:
```bash
curl -s "http://localhost:4000/trades/recent?limit=3" | jq .
```
