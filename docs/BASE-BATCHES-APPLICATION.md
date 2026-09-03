# Base Batches Application Answers — ViperX

*Copy-paste source of truth for the Base Batches application form. Plain, specific, and grounded strictly in existing repository code and testnet deployments.*

---

### Application Metadata
- **Project Name**: ViperX
- **Founder**: Ritesh ([@Ritesh5969](https://x.com/Ritesh5969))
- **Email**: [FOUNDER FILL]
- **Team Size**: Solo technical founder [FOUNDER FILL if contractors involved]
- **Prior Funding**: Bootstrapped / Pre-seed ($0 raised to date) [FOUNDER FILL]
- **Live Demo UI**: https://viper-x-lake.vercel.app
- **GitHub Repository**: https://github.com/ritesh59697/viperx
- **Primary Contracts (Base Sepolia)**:
  - `ViperVault`: [`0x68c59b55359Dc36D9E842e7314Da1150a964f4C7`](https://sepolia.basescan.org/address/0x68c59b55359Dc36D9E842e7314Da1150a964f4C7)
  - `PositionRouter`: [`0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F`](https://sepolia.basescan.org/address/0x1E8500fA19C416064416Ad5Ed8a68A7d569Cc63F)
  - `PythPriceAdapter`: [`0x36B9e0D1b0702FC59114A87f277b836d482EaF6A`](https://sepolia.basescan.org/address/0x36B9e0D1b0702FC59114A87f277b836d482EaF6A)

---

### 1. Company One-Liner (1 sentence)
ViperX is the on-chain proof layer for AI trading agents on Base, ranking agents on settled USDC fills rather than self-reported screenshots.

---

### 2. Problem (80–120 words)
Self-reported track records for AI trading agents are easy to spoof. Agents post social screenshots, backtests on cherry-picked windows, or modify centralized database counters without risking capital. Even on-chain counter calls like `record_trade` can be looped permissionlessly by an agent's own authority without ever placing a trade. Capital allocators and copy-traders have no mechanism to distinguish legitimate algorithmic performance from fabricated claims. Because no independent verification layer reconciles self-reported execution against actual on-chain collateral and settled fills, agent performance remains unverified, highly gameable, and unsuitable for serious capital allocation.

---

### 3. Product (80–120 words)
ViperX separates execution from independent verification. Agents register non-custodial identities on Base Sepolia and trade via delegated authority without moving user funds. An independent background indexer monitors on-chain contract events (`ViperVault` and Pyth Oracle mark prices), reconciles claimed trades against settled USDC position deltas, and filters out wash trades, circular hedging, and sub-$0.50 divergence. To earn a rank on the public leaderboard, an agent must pass an anti-gaming gate requiring at least 50 independently verified fills. Agents claiming trades without confirmed settlement sit unranked, creating a transparent, cryptographic track record.

---

### 4. Why Base is Default (80 words)
Base is our primary home because algorithmic trading agents require native USDC settlement, predictable sub-cent gas fees, and deep ecosystem liquidity. Agent loops trigger continuous micro-transactions, where even small L1 gas spikes break high-frequency strategies. Base provides native Circle USDC without bridge risk, high transaction throughput, and direct access to retail capital through the Coinbase Smart Wallet distribution funnel. For an on-chain proof layer evaluating autonomous agents, Base delivers the exact fee and liquidity environment needed.

---

### 5. Stage / Traction — Honest Testnet Wording (60 words)
ViperX is an unaudited testnet protocol live on Base Sepolia with zero mainnet TVL and no active commercial users. The end-to-end stack is operational: Base contracts (`ViperVault`, `PositionRouter`, `PythPriceAdapter`), indexer daemon, and Next.js interface. Our live demo showcases the core anti-gaming thesis: testnet agents claiming 50 trades with 0 verified on-chain fills sit visibly unranked on the public leaderboard.

---

### 6. Why This Founder (80 words)
Founder: Ritesh (@Ritesh5969). Solo technical builder who has previously shipped ConfidentialPay (confidential EVM payment gateway), PrivyBags (embedded wallet social tokens), and xpulse-ai (AI market intelligence agent runtime). Full-stack engineer experienced in Solidity smart contract development, TypeScript/Next.js frontend systems, and high-throughput real-time indexing runtimes. Built and delivered the entire ViperX dual-chain smart contract architecture, indexer daemons, anti-gaming algorithms, and web interface end-to-end.

---

### 7. 8-Week Plan (4 bullets)
- **Weeks 1–2**: Gas optimization and contract hardening for Base mainnet registry, `ViperVault`, and `PositionRouter`.
- **Weeks 3–4**: Base mainnet contract deployment and provisioning initial USDC seed liquidity into non-custodial vaults.
- **Weeks 5–6**: Onboarding and bootstrapping the first cohort of 20 autonomous quantitative trading agents on Base mainnet.
- **Weeks 7–8**: Launch the public verified Base mainnet leaderboard with real-time settlement verification and anti-gaming gates.

---

### 8. Use of $100K (4 bullets)
ViperX is currently an unaudited testnet. The $100K is dedicated to delivering our Base mainnet production milestone:
- **Base Mainnet Registry**: Gas optimization, contract hardening, and deployment of the on-chain agent registry and routing contracts on Base mainnet.
- **USDC Vault Liquidity**: Initial seed capital in native USDC allocated to non-custodial `ViperVault` to guarantee fill settlement for agent trading loops.
- **Public Verified Leaderboard**: Production indexer infrastructure, failover Postgres clustering, and Pyth oracle integrations powering the real-time public leaderboard.
- **First 20 Agents Cohort**: Developer onboarding incentives, gas subsidies, and technical integration support to bootstrap the first 20 verified quantitative trading agents on Base.

---

### 9. Multi-Chain Policy (2 sentences)
Base is the default network and primary home for our contracts, liquidity, and roadmap. Solana Devnet contracts exist as an optional secondary venue for parallel SVM execution, planned for expansion only after Base mainnet is established.

---

### 10. What We Are Not Pitching
- **No Token**: We are not launching a speculative protocol or governance token; there is no token in this roadmap.
- **No Retail Perp DEX**: We are not building a consumer derivatives exchange; `ViperVault` is an execution substrate solely used to verify agent fills.
- **No Audited Mainnet Protocol**: We are an unaudited testnet today with zero mainnet TVL. We make no false claims of external audits, production hardening, or mainnet scale.
