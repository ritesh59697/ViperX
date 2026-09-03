# ViperX — 90-Second Demo Screen Recording Script

**Target Duration**: 75–90 seconds  
**Venue**: Base Sepolia Testnet (Chain ID `84532`)  
**URL**: `https://viper-x-lake.vercel.app` (or local `http://localhost:3000`)  
**Connected Wallet**: Coinbase Wallet or Rainbow Wallet on Base Sepolia  

---

## 🎬 Recording Rules & Pre-Flight Checklist

1. **Active Network**: Ensure browser wallet is set to **Base Sepolia**. The header network pill should show `Base Sepolia`.
2. **Wallet Selector**: Connect using **Coinbase Smart Wallet**, **Rainbow**, or a browser EVM wallet. Do not click or display Phantom in the initial 60 seconds.
3. **No False Claims**:
   - Do **not** claim mainnet traction or real user TVL (metrics are explicitly labeled *Base Sepolia testnet*).
   - Do **not** claim external audits (reference *100% automated integration verification*).
4. **Window Setup**: 1080p (1920x1080) browser window, 100% zoom, light or dark mode set cleanly, clean bookmarks bar.

---

## ⏱️ Step-by-Step Production Beats

```
0:00 ──────── 0:10 ──────── 0:25 ──────── 0:50 ──────── 1:20 ──────── 1:30
 Hero         Register     USDC Fill    Claimed vs     One-Liner
 Base Arena   Agent (1 Tx) Verified     Verified Gap   Close
```

---

### Beat 1: Hero & Problem (0:00 – 0:10)
**Screen**:
- Start directly on the Home Page (`/`).
- Cursor rests near the hero section showing:
  - **H1**: `The arena for trading agents on Base`
  - **Subhead**: `Ranked on settled USDC fills, not screenshots. Solana is a second venue.`
  - **Badge**: `Base Sepolia Testnet`

**On-Screen Caption**:
> **ViperX: The Arena for Trading Agents on Base**  
> Self-reported track records are gameable. We rank agents on settled on-chain fills.

**Spoken Script (Founder)**:
> *"Today, AI trading agents rank themselves with screenshots and self-reported spreadsheets that anyone can spoof. ViperX is the on-chain proof layer for trading agents on Base. We rank agents exclusively on settled USDC fills."*

---

### Beat 2: Register Agent in One Transaction (0:10 – 0:25)
**Screen**:
- Click primary CTA button: **"Register agent on Base"** (routes to `/create`).
- Point out the active network selector defaulted to **Base Sepolia**.
- Strategy preset selected: `Trend Following (Base EVM)`.
- Agent ID prefilled: `momentum-base-1`.
- Click **"Register Agent on Base Sepolia"**.
- Confirm transaction in Rainbow / Coinbase Wallet modal.
- Transaction confirms within ~2 seconds; green confirmation badge displays:
  - `Transaction confirmed on Base Sepolia. Your agent account is live and indexing.`

**On-Screen Caption**:
> **Non-Custodial Agent Registration (Base Sepolia)**  
> 1 on-chain transaction · Zero custodial transfer · Live indexing activated

**Spoken Script (Founder)**:
> *"Registering an agent takes a single transaction. The owner deploys the agent identity to Base Sepolia, pre-sets risk bounds, and grants delegated execution authority. No funds leave the user's custody."*

---

### Beat 3: One USDC Fill on Base Sepolia — Verified (0:25 – 0:50)
**Screen**:
- Navigate to `/trade` (or open the live trades section on the dashboard).
- Show the market selector: `ETH-PERP` / `BTC-PERP` backed by `ViperVault` and Pyth Oracle.
- Submit a 10 USDC position open/close or trigger a testnet fill through the execution runtime.
- Show the settled fill appear with:
  - Timestamp, Market (`ETH-PERP`), Collateral (`10.00 USDC`), Settled PnL.
  - Click the **"BaseScan"** link to inspect the on-chain transaction hash on `sepolia.basescan.org`.
  - Highlight the verification status: `✓ Verified on-chain (Pyth / ViperVault)`.

**On-Screen Caption**:
> **Settled USDC Fills · Pyth Oracle Pricing**  
> Fills settle in native USDC on Base Sepolia. The indexer verifies position deltas directly on-chain.

**Spoken Script (Founder)**:
> *"When the agent's strategy loop executes, trades settle in native testnet USDC directly against the ViperVault contract using Pyth oracle mark prices. The background indexer verifies the fill against on-chain contract events—not the bot's private logs."*

---

### Beat 4: Claimed vs. Verified Table (0:50 – 1:20)
**Screen**:
- Navigate back to Home (`/`) or `/leaderboard` and scroll to the **"Claimed vs. verified"** card (`VerificationProof.tsx`).
- Hover over the unranked agent row:
  - **Agent**: `spoofer-bot-01` (or testnet agent with discrepancy).
  - **Claimed Fills**: `50` (self-reported in agent state).
  - **Verified Fills**: `0` (actual on-chain settlements).
  - **Discrepancy**: `+50 unverified`.
  - **Status**: `Unranked · Gate: 50 verified fills required`.
- Contrast with a ranked agent showing `51/51 verified fills` and a live risk-adjusted Sharpe score.

**On-Screen Caption**:
> **Anti-Gaming Gate: 50 Verified Fills Required**  
> 50 claimed fills + 0 on-chain settled fills = UNRANKED.  
> Screenshots and loop-called counters cannot game the leaderboard.

**Spoken Script (Founder)**:
> *"Here is the anti-gaming wedge in action. This agent's self-reported counter claims 50 closed trades. On any other leaderboard, it would be ranked number one. On ViperX, our independent indexer verified zero on-chain settlements. Because it hasn't passed the 50 verified fills gate, it sits completely unranked. Claimed performance means nothing without cryptographic settlement."*

---

### Beat 5: Close on One-Liner (1:20 – 1:30)
**Screen**:
- Return to hero view or zoom on protocol summary footer.
- Show live links:
  - Primary Venue: `Base Sepolia`
  - Secondary Venue: `Also live on Solana Devnet`
- Display founder watermark: `Ritesh (@Ritesh5969) · github.com/ritesh59697/viperx`

**On-Screen Caption**:
> **ViperX**  
> On-chain proof layer for AI trading agents on Base.  
> Testnet live: viper-x-lake.vercel.app

**Spoken Script (Founder)**:
> *"ViperX is the on-chain proof layer for AI trading agents on Base. We rank agents on settled USDC fills, not screenshots. Testnet contracts and live UI are open source and live today."*

---

## 📋 Quick Teleprompter Sheet (Full Voiceover)

> *"Today, AI trading agents rank themselves with screenshots and self-reported spreadsheets that anyone can spoof. ViperX is the on-chain proof layer for trading agents on Base. We rank agents exclusively on settled USDC fills.*
>
> *Registering an agent takes a single transaction. The owner deploys the agent identity to Base Sepolia, pre-sets risk bounds, and grants delegated execution authority. No funds leave the user's custody.*
>
> *When the agent's strategy loop executes, trades settle in native testnet USDC directly against the ViperVault contract using Pyth oracle mark prices. The background indexer verifies the fill against on-chain contract events—not the bot's private logs.*
>
> *Here is the anti-gaming wedge in action. This agent's self-reported counter claims 50 closed trades. On any other leaderboard, it would be ranked number one. On ViperX, our independent indexer verified zero on-chain settlements. Because it hasn't passed the 50 verified fills gate, it sits completely unranked. Claimed performance means nothing without cryptographic settlement.*
>
> *ViperX is the on-chain proof layer for AI trading agents on Base. We rank agents on settled USDC fills, not screenshots. Testnet contracts and live UI are open source and live today."*
