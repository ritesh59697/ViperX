# ViperX — 3-Minute Hackathon Demo Script (Colosseum / Solana Track)

> **Contest**: Crypto World’s Fair Hackathon (Colosseum)  
> **Target Track**: Solana Track ($100,000) & Grand Champion  
> **Duration**: Exactly 3 Minutes (180 Seconds)  
> **Format**: High-contrast, dynamic screencast with live split-screen attack detection  

---

## 🎬 Master Timing Breakdown

```
┌───────────┬────────────────────────────────────────────────────────────┐
│ Timestamp │ Scene & Narrative Phase                                    │
├───────────┼────────────────────────────────────────────────────────────┤
│ 0:00–0:30 │ The Crisis: The "Fake ROI" Epidemic in Autonomous Finance  │
│ 0:30–1:30 │ "The Money Shot": Live Divergence Catch (ScamBot Flagged)  │
│ 1:30–2:15 │ The Real Deal: AlphaQuant & Pure On-Chain Verification     │
│ 2:15–2:45 │ "Who Watches the Watcher?": Standalone 1-Command CLI       │
│ 2:45–3:00 │ The Vision: Multi-Chain Architecture & Call to Action      │
└───────────┴────────────────────────────────────────────────────────────┘
```

---

## [0:00 – 0:30] Phase 1: The Crisis (The "Fake ROI" Problem)

### 🖥️ On Screen:
- Quick montage or screenshot showing AI agents on Twitter/Crypto boasting "+5,000% ROI" or "God-Mode Quant Agent".
- Open Solana Explorer showing an arbitrary smart contract with a counter: `record_trade()` being spammed 100 times in 10 seconds.

### 🎙️ Spoken Script:
> *"Every day, new 'autonomous trading agents' launch on Twitter claiming 1,000% returns and algorithmic genius. But in crypto today, every agent grades its own homework. Anyone can spin up an agent, loop an on-chain counter, or self-report fabricated fills.*
>
> *If autonomous finance is going to manage real institutional capital, we cannot trust self-reported marketing screenshots. We need **cryptographic, zero-trust proof of execution**.*
>
> *This is **ViperX** — the verification layer and performance evaluation engine for autonomous trading agents on Solana."*

---

## [0:30 – 1:30] Phase 2: "The Money Shot" (Live Divergence Detection)

### 🖥️ On Screen:
- Switch to the live **ViperX Public Leaderboard** (`http://localhost:3000/leaderboard` or production).
- Toggle `?all=true` or filter to show unverified/flagged bots.
- Click on **ScamBot (`pnl-divergence-attacker`)**:
  - Show the self-reported claim: **+$9,999 ROI**.
  - Show the live ViperX Verification Ribbon:
    - Real on-chain settled PnL on Velocity DEX: **$0.00**.
    - Watcher reconciles live: Divergence **$9,999.00 > $0.50 threshold**.
    - Slap on the prominent badge: **[⚠️ DIVERGENCE FLAGGED]**.
  - Show the reason: `"Self-reported PNL diverges from on-chain-verified PNL on 2 trade(s)"`.
  - Notice ScamBot is completely stripped of rank (`Rank: Unranked`).

### 🎙️ Spoken Script:
> *"Let's put this to the test with an adversarial simulation. Meet ScamBot. It executed a real Solana trade, but then immediately tampers with its local database to report a fraudulent +$9,999 profit.*
>
> *In any conventional system, ScamBot would top the leaderboard. But watch what happens on ViperX.*
>
> *Our independent Velocity DEX event-log watcher intercepts the on-chain `SettlePnlRecord` directly from Drift's post-exploit rebuild program. It compares the self-reported claim against the raw on-chain settlement.*
>
> *Instantly, a divergence is flagged: $9,999 reported vs $0.00 settled. ScamBot is quarantined with an indelible red warning badge, stripped of its rank, and permanently barred from leaderboard eligibility. Cheating is mathematically impossible."*

---

## [1:30 – 2:15] Phase 3: The Real Deal (Authentic On-Chain Track Record)

### 🖥️ On Screen:
- Click into an authentic verified agent: **`CLqQSNFH...` (Watcher Verify Bot / AlphaQuant)**.
- Highlight the **Quant Verification Standard** banner:
  - External Venue: **Velocity DEX (Drift Rebuild `vELoC1audYbSYVRXn1vPaV8Axoa9oU6BYmNGZZBDZ1P`)**.
  - Track Record Span: **29.1 hours across sessions (Anti-burst gate passed: ≥4.0h)**.
  - Verified Fills: **51 / 50 statistical baseline met**.
  - Risk Metric: **Sharpe Ratio 1.49 [±0.20, 95% CI]**.
- Show the confirmed transaction signatures table linking directly to Solana Explorer.

### 🎙️ Spoken Script:
> *"Now let's see an authentic agent. This is an open-source momentum agent operating on Solana Devnet.*
>
> *Notice three critical quant standards:*
> *First: External venue execution. Every single trade settled on Velocity DEX, incurring real market slippage and exchange fees.*
> *Second: The Anti-Burst gate. All 51 fills span across 29 hours of live market sessions, proving this wasn't a 5-minute self-crossing loop.*
> *Third: Statistical rigor. We don't just show raw PnL. We display volatility-adjusted Sharpe ratio with a 95% standard-error confidence interval based on verified sample size.*
>
> *Every fill links directly to its transaction signature on Solana Explorer."*

---

## [2:15 – 2:45] Phase 4: "Who Watches the Watcher?" (Standalone CLI)

### 🖥️ On Screen:
- Open a clean terminal window side-by-side.
- Run the command:
  ```bash
  bun run verify-agent CLqQSNFHXeoPd3siR2fZxTB31QAyCNid5ymXBpoTutn4
  ```
- The terminal instantly connects to `https://api.devnet.solana.com`, fetches the raw Anchor PDA, inspects the Velocity DEX vault subaccount, checks confirmed RPC transaction signatures, and outputs:
  ```
  [✓] VERIFICATION RESULT: AUTHENTIC VERIFIED AGENT
      All track record assertions independently confirmed directly on Solana Devnet RPC.
  ```

### 🎙️ Spoken Script:
> *"A skeptical judge might ask: 'Your web dashboard looks great, but what if your backend server is faking the numbers? Who watches the watcher?'*
>
> *Here is our answer. Anyone in the world can run our open-source verification CLI directly against public Solana Devnet RPC.*
>
> *With a single command: `bun run verify-agent`, the script bypasses our servers completely. It reads the raw Anchor PDA from `viperx_agent_registry`, inspects the Velocity DEX collateral vault, validates confirmed Solana signatures, and prints a zero-trust cryptographic receipt.*
>
> *Total decentralization. Complete reproducibility."*

---

## [2:45 – 3:00] Phase 5: The Vision & Closing

### 🖥️ On Screen:
- Switch back to the landing page showing the unified multi-chain vision:
  - Solana Devnet (Anchor + Velocity DEX) for high-speed quant execution & track-record verification.
  - OKX X Layer for EVM ecosystem liquidity.
  - Model Context Protocol (MCP) endpoint for AI agents.
- Display closing banner: **"ViperX: Verifiable Track Records for Autonomous Capital."**

### 🎙️ Spoken Script:
> *"By separating claimed performance from verified on-chain execution, ViperX transforms autonomous agents from black-box gambles into institutional-grade financial primitives.*
>
> *Live on Solana Devnet with over 180 confirmed transactions and an open-source MIT monorepo.*
>
> *ViperX makes autonomous finance verifiable. Thank you."*

---

## 📋 Recording Checklist for Ritesh

1. **Terminal Setup**:
   - Have terminal open at repository root (`/Users/ritesh/Projects/viperx`).
   - Test command: `bun run verify-agent` (runs in ~1 second).
2. **Browser Tabs Prepared**:
   - Tab 1: `http://localhost:3000/leaderboard` (showing the Leaderboard with authentic agents).
   - Tab 2: `http://localhost:3000/agents/CLqQSNFHXeoPd3siR2fZxTB31QAyCNid5ymXBpoTutn4` (Watcher Verify Bot / 51 fills).
   - Tab 3: `http://localhost:3000/agents/3aubWc8789Bb9THGN68BoCpAF3G1dJ4yYJMCVr6qYCPm` (ScamBot with DIVERGENCE FLAGGED badge).
   - Tab 4: Solana Explorer on Devnet (`https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet`).
3. **Audio Quality**:
   - Clear microphone, no background fan noise.
   - Pacing: ~130–140 words per minute.
4. **Resolution**:
   - Record in crisp 1080p (1920x1080) at 60fps or 30fps.
