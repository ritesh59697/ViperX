"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";

type DocSection =
  | "intro"
  | "quickstart"
  | "architecture"
  | "solana-program"
  | "base-contract"
  | "indexer"
  | "anti-gaming";

interface SidebarItem {
  id: DocSection;
  label: string;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>("intro");
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const groups: SidebarGroup[] = [
    {
      title: "Getting Started",
      items: [
        { id: "intro", label: "Introduction" },
        { id: "quickstart", label: "Quick Start" },
        { id: "architecture", label: "System Architecture" },
      ],
    },
    {
      title: "Smart Contracts",
      items: [
        { id: "solana-program", label: "Solana SVM Program" },
        { id: "base-contract", label: "Base EVM Registry" },
      ],
    },
    {
      title: "Execution & Trust",
      items: [
        { id: "indexer", label: "PnL Indexer" },
        { id: "anti-gaming", label: "Anti-Gaming Heuristics" },
      ],
    },
  ];

  const activeItemLabel = groups
    .flatMap((g) => g.items)
    .find((i) => i.id === activeSection)?.label || "Menu";

  const ChevronDown = ({ open }: { open: boolean }) => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 text-foreground-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <Section width="wide" className="pt-20 pb-24 sm:pt-24 relative z-10">
      {/* --- Mobile Dropdown Menu (GitBook / Mintlify Style) ------------- */}
      <div className="lg:hidden w-full relative mb-6">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between bg-surface border border-border px-4 py-3.5 rounded-xl font-mono text-xs text-foreground cursor-pointer shadow-sm focus:outline-none"
        >
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] text-foreground-faint uppercase font-bold tracking-wider">
              Documentation Menu
            </span>
            <span className="font-semibold text-foreground">
              {activeItemLabel}
            </span>
          </div>
          <ChevronDown open={mobileMenuOpen} />
        </button>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-xl z-[90] p-4 max-h-[350px] overflow-y-auto"
            >
              {groups.map((group, idx) => (
                <div key={idx} className="mb-4 last:mb-0">
                  <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-foreground-faint mb-2">
                    {group.title}
                  </span>
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSection(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full text-left font-mono text-xs py-2 px-3 rounded-lg cursor-pointer transition-all ${
                            activeSection === item.id
                              ? "bg-surface text-foreground font-semibold border border-border"
                              : "text-foreground-muted hover:text-foreground hover:bg-surface/30"
                          }`}
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-10 items-start">
        {/* --- Left Sidebar (Sticky Navigation - Hidden on Mobile) -------- */}
        <aside className="hidden lg:flex lg:flex-col lg:col-span-3 w-full lg:sticky lg:top-24 gap-6 border-r border-border/60 pb-8 lg:pb-0 lg:pr-6 bg-background/90 backdrop-blur-sm">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-accent uppercase tracking-wider font-semibold">
              Documentation
            </span>
            <h2 className="text-sm font-bold text-foreground font-mono">ViperX Protocol</h2>
          </div>

          <nav className="flex flex-col gap-5 w-full">
            {groups.map((group, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 shrink-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-faint">
                  {group.title}
                </span>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full text-left font-mono text-xs py-1.5 px-2.5 rounded-lg cursor-pointer relative z-10 transition-colors ${
                          activeSection === item.id
                            ? "text-foreground font-semibold"
                            : "text-foreground-muted hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </button>
                      {mounted && activeSection === item.id && (
                        <motion.div
                          layoutId="activeDocSection"
                          className="absolute inset-0 bg-surface border border-border rounded-lg shadow-sm z-0"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* --- Main Document Window (Theme-Aware, Legible background) -------- */}
        <main className="lg:col-span-9 w-full flex flex-col gap-6 bg-background/95 backdrop-blur-[2px] p-2 rounded-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="w-full"
            >
              {activeSection === "intro" && (
                <article className="prose prose-invert dark:prose-invert prose-neutral max-w-none">
                  <h1 className="text-2xl font-bold text-foreground font-mono">Introduction</h1>
                  <p className="t-body mt-4 text-sm text-foreground-muted leading-relaxed">
                    ViperX is a high-performance decentralized registry and trustless leaderboard 
                    for AI-powered trading agents. In social and copy trading, users frequently face 
                    information asymmetry: managers share curated screenshots or mock trades, hiding 
                    their actual historical performance and drawdowns. ViperX solves this by verifying 
                    every execution trace directly against on-chain transaction hashes and position history.
                  </p>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    The Verification Problem
                  </h2>
                  <p className="t-body mt-3 text-sm text-foreground-muted leading-relaxed">
                    Centralized trading stats are easy to spoof or manipulate. A manager can modify database 
                    records, run simultaneous opposing accounts to guarantee positive ROI on one, or selectively 
                    delete losing runs. By recording agent accounts to the blockchain, ViperX creates an 
                    immutable audit trail. Every trade must connect to a verified account state and correspond 
                    to actual capital movements.
                  </p>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    Core Design Pillars
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-3 mt-4">
                    <Card variant="muted" className="p-5 font-mono text-xs">
                      <p className="font-semibold text-foreground">On-Chain Registry</p>
                      <p className="text-[10px] text-foreground-muted mt-2 leading-relaxed">
                        Agent configurations, ownership keys, and parameters are stored directly on the Solana SVM and Base EVM registries.
                      </p>
                    </Card>
                    <Card variant="muted" className="p-5 font-mono text-xs">
                      <p className="font-semibold text-foreground">Verifiable Tracking</p>
                      <p className="text-[10px] text-foreground-muted mt-2 leading-relaxed">
                        Trades are indexed from blockchain events and cross-checked against raw on-chain account balances at each block.
                      </p>
                    </Card>
                    <Card variant="muted" className="p-5 font-mono text-xs">
                      <p className="font-semibold text-foreground">Anti-Gaming Filters</p>
                      <p className="text-[10px] text-foreground-muted mt-2 leading-relaxed">
                        Automated statistics loops detect wash trading, round-tripping, and divergence between reported and executed trades.
                      </p>
                    </Card>
                  </div>
                </article>
              )}

              {activeSection === "quickstart" && (
                <article className="prose prose-invert max-w-none">
                  <h1 className="text-2xl font-bold text-foreground font-mono">Quick Start</h1>
                  <p className="t-body mt-4 text-sm text-foreground-muted leading-relaxed">
                    Follow this guide to deploy your first quantitative trading agent and index its metrics.
                  </p>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    Prerequisites
                  </h2>
                  <p className="t-body mt-3 text-sm text-foreground-muted leading-relaxed">
                    Before initializing, ensure your browser wallet is funded with testnet gas and collateral:
                  </p>
                  <ul className="mt-3 space-y-2 font-mono text-xs text-foreground-muted list-disc list-inside">
                    <li>Solana Devnet: Funded with at least 0.5 Devnet SOL.</li>
                    <li>Base Sepolia: Funded with Sepolia ETH and testnet USDC.</li>
                  </ul>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    Step-by-Step Setup
                  </h2>
                  <div className="flex flex-col gap-6 mt-6 font-mono text-xs">
                    <div className="flex gap-4">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground font-sans">1</span>
                      <div>
                        <p className="font-bold text-foreground">Select a Strategy Template</p>
                        <p className="text-[11px] text-foreground-muted mt-1 leading-relaxed">
                          Navigate to the Deploy Agent page. Choose a strategy template (Trend Following, RSI Mean Reversion, or Grid Market Maker) to prefill the strategy URI and bounds.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground font-sans">2</span>
                      <div>
                        <p className="font-bold text-foreground">Define Parameters & Collateral</p>
                        <p className="text-[11px] text-foreground-muted mt-1 leading-relaxed">
                          Set a unique Agent ID and descriptive name. Specify the vault public address where trading collateral will reside, and authorize delegated execution access to the runtime keys.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground font-sans">3</span>
                      <div>
                        <p className="font-bold text-foreground">Authorize Transaction</p>
                        <p className="text-[11px] text-foreground-muted mt-1 leading-relaxed">
                          Sign the deployment transaction. This allocates storage accounts on Solana or logs mappings to the Base contract. Once confirmed, the indexer starts tracking trades automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {activeSection === "architecture" && (
                <article className="prose prose-invert max-w-none">
                  <h1 className="text-2xl font-bold text-foreground font-mono">System Architecture</h1>
                  <p className="t-body mt-4 text-sm text-foreground-muted leading-relaxed">
                    The ViperX protocol is composed of three interconnected layers: on-chain smart contracts (Registry), off-chain log scanners (Indexer), and the web client.
                  </p>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    Layer Specifications
                  </h2>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mt-6">
                    {[
                      {
                        group: "VAULT LAYER",
                        items: ["Program Registry PDA", "Velocity Deposit Escrow", "Event Transaction Log", "Realized PnL Stream"],
                      },
                      {
                        group: "REGISTRY LAYER",
                        items: ["Base Sepolia NFT Contract", "EVM Node Logs Listener", "GMX Contract Execution", "ERC-20 Collateral Handler"],
                      },
                      {
                        group: "RISK PROTOCOL",
                        items: ["Leverage Limits Controller", "Session Heartbeat Monitor", "Historical Drawdown Engine", "Postgres Real-time Sink"],
                      },
                      {
                        group: "PLATFORM SUITE",
                        items: ["Leaderboard API (Next ISR)", "Solana Program PDA Creator", "Arena Matchmaking Queue", "Wallet Ownership Signer"],
                      },
                    ].map((col, i) => (
                      <div key={i} className="flex flex-col gap-2 font-mono text-[11px]">
                        <h3 className="font-bold text-accent uppercase tracking-wider">{col.group}</h3>
                        <div className="flex flex-col gap-2 bg-surface/30 border border-border/60 rounded-xl p-4 text-foreground-muted">
                          {col.items.map((item, j) => (
                            <div key={j} className="flex items-center gap-2">
                              <span>└─</span>
                              <span className="truncate">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              {activeSection === "solana-program" && (
                <article className="prose prose-invert max-w-none">
                  <h1 className="text-2xl font-bold text-foreground font-mono">Solana SVM Program</h1>
                  <p className="t-body mt-4 text-sm text-foreground-muted leading-relaxed">
                    On Solana, registry data is managed by an Anchor program deployed to Devnet at address <code className="font-mono text-foreground font-bold">321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm</code>.
                  </p>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    Account Structure
                  </h2>
                  <p className="t-body mt-3 text-sm text-foreground-muted leading-relaxed">
                    Every agent is initialized as a Program Derived Address (PDA) using seed formatting to guarantee uniqueness. 
                    The PDA seeds are derived as follows: <code className="font-mono text-foreground">seeds = [b"agent", owner_pubkey, agent_id_bytes]</code>.
                  </p>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    Rust Anchor Code Specification
                  </h2>
                  <pre className="mt-4 p-4 rounded-xl bg-surface/40 border border-border/50 font-mono text-[10px] text-foreground-muted overflow-x-auto leading-relaxed">
                    {`#[program]
pub mod viperx_registry {
    use super::*;

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_id: String,
        name: String,
        strategy_uri: String,
        vault_address: Pubkey,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.owner = *ctx.accounts.owner.key;
        agent.vault = vault_address;
        agent.agent_id = agent_id;
        agent.name = name;
        agent.strategy_uri = strategy_uri;
        agent.trade_count = 0;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 32 + 64 + 64 + 8,
        seeds = [b"agent", owner.key().as_ref(), agent_id.as_bytes()],
        bump
    )]
    pub agent: Account<'info, Agent>,

    pub system_program: Program<'info, System>,
}`}
                  </pre>
                </article>
              )}

              {activeSection === "base-contract" && (
                <article className="prose prose-invert max-w-none">
                  <h1 className="text-2xl font-bold text-foreground font-mono">Base EVM Registry</h1>
                  <p className="t-body mt-4 text-sm text-foreground-muted leading-relaxed">
                    The EVM registry is a Solidity contract deployed on Base Sepolia. It manages unique string ID lookups 
                    pointing to agent parameters and owner addresses.
                  </p>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    Solidity Smart Contract Implementation
                  </h2>
                  <p className="t-body mt-3 text-sm text-foreground-muted leading-relaxed">
                    The solidity code tracks agent registry details, fires logging events for off-chain indexers, and protects against unauthorized parameter changes:
                  </p>
                  <pre className="mt-4 p-4 rounded-xl bg-surface/40 border border-border/50 font-mono text-[10px] text-foreground-muted overflow-x-auto leading-relaxed">
                    {`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ViperxRegistry {
    struct Agent {
        address owner;
        string agentId;
        string name;
        string strategyUri;
        address vaultAddress;
        uint256 registeredAt;
    }

    mapping(string => Agent) private _agents;
    mapping(address => string[]) private _ownerAgents;

    event AgentRegistered(
        address indexed owner,
        string indexed agentId,
        string name,
        address vaultAddress
    );

    function registerAgent(
        string calldata agentId,
        string calldata name,
        string calldata strategyUri,
        address vaultAddress
    ) external {
        require(bytes(agentId).length > 0, "Empty ID");
        require(_agents[agentId].owner == address(0), "ID already in use");

        _agents[agentId] = Agent({
            owner: msg.sender,
            agentId: agentId,
            name: name,
            strategyUri: strategyUri,
            vaultAddress: vaultAddress,
            registeredAt: block.timestamp
        });

        _ownerAgents[msg.sender].push(agentId);

        emit AgentRegistered(msg.sender, agentId, name, vaultAddress);
    }
}`}
                  </pre>
                </article>
              )}

              {activeSection === "indexer" && (
                <article className="prose prose-invert max-w-none">
                  <h1 className="text-2xl font-bold text-foreground font-mono">PnL Indexer</h1>
                  <p className="t-body mt-4 text-sm text-foreground-muted leading-relaxed">
                    The background indexer polls block events and transaction traces from the blockchain. 
                    Instead of trusting self-reported numbers, the indexer queries oracle values (Pyth/Chainlink) at the exact transaction block height.
                  </p>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    Reconciliation Pipeline
                  </h2>
                  <div className="flex flex-col gap-4 mt-4 font-mono text-xs text-foreground-muted">
                    <div className="border border-border/40 p-4 rounded-xl bg-surface/30">
                      <p className="font-semibold text-foreground">1. Trade Collection</p>
                      <p className="text-[10px] mt-1">The execution runtime self-reports trading activity, writing transactions to the database. These records are initially marked as pending verification.</p>
                    </div>
                    <div className="border border-border/40 p-4 rounded-xl bg-surface/30">
                      <p className="font-semibold text-foreground">2. Position Monitoring</p>
                      <p className="text-[10px] mt-1">Independent indexer loops monitor trade collateral vaults. For Solana, it polls Velocity perp positions. For Base, it tracks GMX account log outputs.</p>
                    </div>
                    <div className="border border-border/40 p-4 rounded-xl bg-surface/30">
                      <p className="font-semibold text-foreground">3. Settlement Audit</p>
                      <p className="text-[10px] mt-1">When a position close is observed, the indexer fetches Pyth or Chainlink price feeds at that timestamp, computes realized returns, and reconciles the results.</p>
                    </div>
                  </div>
                </article>
              )}

              {activeSection === "anti-gaming" && (
                <article className="prose prose-invert max-w-none">
                  <h1 className="text-2xl font-bold text-foreground font-mono">Anti-Gaming Heuristics</h1>
                  <p className="t-body mt-4 text-sm text-foreground-muted leading-relaxed">
                    A ranked agent requires a minimum of 50 verified fills. In addition, our heuristics check trade history to flag synthetic volume.
                  </p>

                  <h2 className="text-base font-bold text-foreground font-mono mt-8 border-b border-border/60 pb-2">
                    Heuristics Auditing System
                  </h2>
                  <p className="t-body mt-3 text-sm text-foreground-muted leading-relaxed">
                    ViperX runs statistical scans across transaction history to block exploitation attempts:
                  </p>

                  <div className="space-y-4 mt-6 font-mono text-xs">
                    <div className="flex gap-4 items-start border-l-2 border-accent pl-4">
                      <div>
                        <p className="font-bold text-foreground">Wash Trading Detection</p>
                        <p className="text-[10px] text-foreground-muted mt-1 leading-relaxed">
                          Flags accounts that execute rapid offsetting trades (e.g. buying and selling the same contract within short intervals) to inflate transaction metrics without holding real exposure.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start border-l-2 border-accent pl-4">
                      <div>
                        <p className="font-bold text-foreground">Circular Hedging Audit</p>
                        <p className="text-[10px] text-foreground-muted mt-1 leading-relaxed">
                          Compares correlation between separate registered wallets. Flags instances where Wallet A goes long and Wallet B goes short simultaneously to create artificially low-risk return stats.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start border-l-2 border-accent pl-4">
                      <div>
                        <p className="font-bold text-foreground">PnL Divergence Checking</p>
                        <p className="text-[10px] text-foreground-muted mt-1 leading-relaxed">
                          Matches reported execution-runtime returns with actual on-chain collateral increases. If divergence exceeds the $0.50 threshold, the trade is flagged for review.
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </Section>
  );
}
