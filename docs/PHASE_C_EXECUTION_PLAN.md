# ViperX Phase C Execution Plan — Closing the Live Routing Loop

**Status**: Active Execution Blueprint  
**Objective**: Connect autonomous AI agents directly to the native `ViperVault` perpetual pool on **Base Sepolia**, index real on-chain fills, and update the live public leaderboard with clickable BaseScan explorer proofs.  

---

## 1. The Core Loop

$$\text{AI Agent Intent} \xrightarrow{\text{EIP-712}} \text{PositionRouter (Base Sepolia)} \xrightarrow{\text{On-Chain Fill}} \text{PnL Indexer} \xrightarrow{\text{Verified Settlement}} \text{Leaderboard Movement}$$

Grant reviewers and judges do not evaluate static UI prototypes—they evaluate **unbreakable on-chain proof**. Success in Phase C means a user can open the ViperX Leaderboard, see an agent with a positive Sharpe ratio, click its trade link, and view a `PositionClosed` event settled directly inside **your `ViperVault` smart contract on BaseScan**.

---

## 2. 7-Day Sprint Milestones

| Day | Milestone | Concrete Deliverable |
| :---: | :--- | :--- |
| **Day 1** | **Base Sepolia Deployment** | Broadcast `DeployViperPerp.s.sol` to Base Sepolia testnet. Write `DEPLOYED.md` containing verified contract addresses and BaseScan links. |
| **Day 2–3** | **Execution Runtime Direct Wiring** | Add Base Sepolia driver to `backend/execution-runtime/`. Agents construct and sign EIP-712 `AgentIntent` structs and submit them to `PositionRouter`. |
| **Day 4** | **On-Chain Event Indexing** | Point `backend/pnl-indexer/` to listen for `PositionClosed` events on Base Sepolia. Insert verified trades with real transaction hashes into Postgres. |
| **Day 5–6** | **3-Agent Live Arena Tournament** | Launch 3 competing automated strategy bots (Momentum, RSI Mean-Reversion, Breakout). Let them trade against the pool and reshuffle leaderboard ranks live. |
| **Day 7** | **Demo Video & Grant Submission** | Record a clean 90-second demo following `docs/DEMO-SCRIPT.md` (Agent creation → On-chain trade execution on ViperX Perps → Real-time leaderboard update). |

---

## 3. Strict Guardrails (What NOT to Build)

To eliminate distraction and maintain rapid velocity, the following are strictly frozen during Phase C:
- ❌ **NO new frontend pages or restyling passes** (The UI is already complete and verified).
- ❌ **NO additional market additions** (Stick strictly to `ETH-PERP` and `SOL-PERP` on Base Sepolia).
- ❌ **NO high leverage tiers** (Keep max leverage capped at 5x for pool safety).
- ❌ **NO engine rewrites** (`ViperVault.sol` and `PositionRouter.sol` are 100% test-verified).

---

## 4. Technical Wiring Breakdown

```
┌────────────────────────────────────────────────────────┐
│  1. backend/execution-runtime/ (Agent Driver)          │
│     • Loads Agent Private Key / Session Delegate       │
│     • Signs EIP-712 `AgentIntent` struct               │
│     • Calls `PositionRouter.executeAgentIntent()`      │
└──────────────────────────┬─────────────────────────────┘
                           │ Broadcasts Transaction
                           ▼
┌────────────────────────────────────────────────────────┐
│  2. Base Sepolia Blockchain                            │
│     • `PositionRouter` validates signature & price     │
│     • `ViperVault` opens/closes position against Pyth  │
│     • Emits `PositionClosed(key, trader, pnl, payout)` │
└──────────────────────────┬─────────────────────────────┘
                           │ Emits On-Chain Event Logs
                           ▼
┌────────────────────────────────────────────────────────┐
│  3. backend/pnl-indexer/ (Base Event Listener)         │
│     • Captures `PositionClosed` log from RPC           │
│     • Verifies settled PnL & stores BaseScan Tx Hash   │
│     • Writes into Postgres `trades` table              │
└──────────────────────────┬─────────────────────────────┘
                           │ Updates Database
                           ▼
┌────────────────────────────────────────────────────────┐
│  4. frontend/app/leaderboard/ (Public UI)              │
│     • Recomputes risk-adjusted Sharpe rankings         │
│     • Displays agent rank with clickable BaseScan link │
└────────────────────────────────────────────────────────┘
```

---

## 5. Verification & Acceptance Criteria

Phase C is complete when all 5 conditions are satisfied on live Base Sepolia:

1. [ ] `ViperVault` and `PositionRouter` deployed on Base Sepolia with addresses published in `DEPLOYED.md`.
2. [ ] At least one autonomous agent executes an EIP-712 signed position open and close on Base Sepolia.
3. [ ] `pnl-indexer` records the trade in Postgres with `onchain_verified_pnl` populated.
4. [ ] The frontend Leaderboard displays the trade with a working BaseScan transaction explorer link.
5. [ ] 3 competing testnet bots generate active trading volume in the Arena without manual intervention.
