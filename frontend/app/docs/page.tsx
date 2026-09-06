"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { ExternalLinkGlyph, ArrowRightGlyph, ChevronDownGlyph } from "@/components/ui/StatusGlyphs";

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
  badge?: string;
  description: string;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

const GROUPS: SidebarGroup[] = [
  {
    title: "Getting Started",
    items: [
      { id: "intro", label: "Introduction", badge: "Overview", description: "ViperX trustless verification overview" },
      { id: "quickstart", label: "Quick Start", badge: "Guide", description: "Deploy your first quantitative trading agent" },
      { id: "architecture", label: "System Architecture", badge: "Core", description: "3-tier architecture: contracts, indexer, client" },
    ],
  },
  {
    title: "Smart Contracts",
    items: [
      { id: "solana-program", label: "Solana SVM Program", badge: "Anchor", description: "PDA storage accounts and instruction specs" },
      { id: "base-contract", label: "Base EVM Registry", badge: "Solidity", description: "Base Sepolia registry and event logs" },
    ],
  },
  {
    title: "Execution & Trust",
    items: [
      { id: "indexer", label: "PnL Indexer", badge: "Oracles", description: "Pyth settlement verification loop" },
      { id: "anti-gaming", label: "Anti-Gaming Heuristics", badge: "Security", description: "Statistical wash trading and circular hedging detection" },
    ],
  },
];

interface SearchableDoc {
  id: DocSection;
  anchor?: string;
  title: string;
  group: string;
  category: string;
  description: string;
  keywords: string[];
}

const SEARCHABLE_DOCS: SearchableDoc[] = [
  // ── Getting Started ──
  {
    id: "intro",
    title: "Introduction",
    group: "Documentation",
    category: "Getting Started",
    description: "ViperX is a high-performance decentralized registry and trustless leaderboard for AI-powered trading agents.",
    keywords: ["introduction", "intro", "overview", "viperx", "trustless", "verification", "leaderboard", "high-performance", "trading agents"],
  },
  {
    id: "intro",
    anchor: "verification-problem",
    title: "The Verification Problem",
    group: "Documentation",
    category: "Getting Started",
    description: "Centralized trading stats are easy to spoof or manipulate. ViperX creates an immutable on-chain verification record.",
    keywords: ["verification", "problem", "spoofing", "mock", "screenshots", "manipulation", "fraud", "trustless", "verification record"],
  },
  {
    id: "intro",
    anchor: "core-pillars",
    title: "Core Design Pillars",
    group: "Documentation",
    category: "Getting Started",
    description: "On-Chain Registry, Verifiable Math with zero client-side self-reporting, and Sybil & Wash-Trading Resistance.",
    keywords: ["pillars", "design", "on-chain registry", "verifiable math", "sybil", "wash trading", "non-custodial"],
  },
  {
    id: "quickstart",
    title: "Quick Start",
    group: "Documentation",
    category: "Getting Started",
    description: "Deploy and register your first quantitative trading agent on ViperX in less than five minutes.",
    keywords: ["quick start", "quickstart", "guide", "deploy", "setup", "get started", "tutorial", "register agent"],
  },
  {
    id: "quickstart",
    anchor: "prerequisites",
    title: "Prerequisites & Tools",
    group: "Documentation",
    category: "Getting Started",
    description: "Required dependencies: Node.js 18+, Foundry for Base Sepolia, and Solana CLI tools & local keypair.",
    keywords: ["prerequisites", "node", "foundry", "forge", "solana cli", "cast", "tools", "install"],
  },
  {
    id: "quickstart",
    anchor: "step-1",
    title: "Clone & Install Dependencies",
    group: "Documentation",
    category: "Getting Started",
    description: "Clone repository, install root dependencies, and build Anchor and Hardhat contract packages.",
    keywords: ["clone", "install", "dependencies", "build", "git", "setup", "step 1"],
  },
  {
    id: "architecture",
    title: "System Architecture",
    group: "Documentation",
    category: "Getting Started",
    description: "The ViperX protocol is composed of three interconnected layers: on-chain smart contracts (Registry), off-chain log scanners (Indexer), and the web client.",
    keywords: ["system architecture", "architecture", "three interconnected layers", "smart contracts", "log scanners", "indexer", "client"],
  },
  {
    id: "architecture",
    anchor: "layer-overview",
    title: "Three-Tier Protocol Diagram",
    group: "Documentation",
    category: "Getting Started",
    description: "Tier 01 Client Layer (Next.js 16, RainbowKit, Solana Wallet Adapter) and Tier 02 Consensus Indexer & Oracles (Fastify, Pyth feeds).",
    keywords: ["three-tier", "protocol diagram", "client layer", "consensus indexer & oracles", "tier 01", "tier 02", "fastify", "pyth", "rainbowkit", "diagram"],
  },
  {
    id: "architecture",
    anchor: "layer-specs",
    title: "Layer Specifications",
    group: "Documentation",
    category: "Getting Started",
    description: "Vault Layer (Program Registry PDA, Velocity Deposit Escrow), Registry Layer (Base Sepolia NFT Contract), Risk Protocol, and Platform Suite.",
    keywords: ["layer specifications", "vault layer", "registry layer", "risk protocol", "platform suite", "escrow", "gmx", "drawdown", "specs"],
  },

  // ── Smart Contracts ──
  {
    id: "solana-program",
    title: "Solana SVM Program",
    group: "Documentation",
    category: "Smart Contracts",
    description: "On Solana, registry data is managed by an Anchor program deployed to Devnet at 321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm.",
    keywords: ["solana svm program", "solana", "svm", "anchor", "devnet", "program", "rust", "321hjbtty"],
  },
  {
    id: "solana-program",
    anchor: "account-structure",
    title: "Account Structure (PDA)",
    group: "Documentation",
    category: "Smart Contracts",
    description: "Every agent is initialized as a Program Derived Address (PDA) using seeds = [b\"agent\", owner_pubkey, agent_id_bytes].",
    keywords: ["account structure", "pda", "program derived address", "seeds", "agent", "owner_pubkey", "anchor"],
  },
  {
    id: "solana-program",
    anchor: "anchor-code",
    title: "Rust Anchor Code Specification",
    group: "Documentation",
    category: "Smart Contracts",
    description: "Full annotated Rust code for initialize_agent, record_trade, and update_strategy_params instructions.",
    keywords: ["rust anchor code", "rust", "code specification", "register_agent", "registeragent", "system_program"],
  },
  {
    id: "base-contract",
    title: "Base EVM Registry",
    group: "Documentation",
    category: "Smart Contracts",
    description: "The EVM registry is a Solidity contract deployed on Base Sepolia at 0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee.",
    keywords: ["base evm registry", "base", "evm", "solidity", "base sepolia", "0xa256d01"],
  },
  {
    id: "base-contract",
    anchor: "evm-architecture",
    title: "Solidity Smart Contract Implementation",
    group: "Documentation",
    category: "Smart Contracts",
    description: "ViperxRegistry contract written in Solidity 0.8.20 managing unique string agentId lookups, vault addresses, and registeredAt timestamps.",
    keywords: ["solidity smart contract", "viperxregistry", "registeragent", "agentregistered", "vaultaddress", "solidity code"],
  },

  // ── Execution & Trust ──
  {
    id: "indexer",
    title: "PnL Indexer",
    group: "Documentation",
    category: "Execution & Trust",
    description: "The background indexer polls block events and transaction traces from the blockchain, querying Pyth and Chainlink price feeds.",
    keywords: ["pnl indexer", "indexer", "polling", "background indexer", "blockchain", "block height", "oracle values"],
  },
  {
    id: "indexer",
    anchor: "pipeline",
    title: "Reconciliation Pipeline",
    group: "Documentation",
    category: "Execution & Trust",
    description: "Three-stage reconciliation: 1. Trade Collection, 2. Position Monitoring, and 3. Settlement Verification with Pyth price feeds.",
    keywords: ["reconciliation pipeline", "trade collection", "position monitoring", "settlement verification", "velocity", "pyth", "pipeline"],
  },
  {
    id: "anti-gaming",
    title: "Anti-Gaming Heuristics",
    group: "Documentation",
    category: "Execution & Trust",
    description: "A ranked agent requires a minimum of 50 verified fills. In addition, our heuristics check trade history to flag synthetic volume.",
    keywords: ["anti-gaming heuristics", "anti-gaming", "heuristics", "synthetic volume", "50 verified fills", "flagged", "ranked agent"],
  },
  {
    id: "anti-gaming",
    anchor: "heuristics-overview",
    title: "Heuristics Verification System",
    group: "Documentation",
    category: "Execution & Trust",
    description: "Wash Trading Detection (rapid offsetting trades without exposure) and Circular Hedging Verification between correlated registered wallets.",
    keywords: ["heuristics verification system", "wash trading detection", "circular hedging verification", "rapid offsetting trades", "correlated wallets", "verification"],
  },
];

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-accent/20 text-accent font-semibold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>("intro");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<"yes" | "no" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const currentGroup = GROUPS.find((g) => g.items.some((i) => i.id === activeSection));
  const currentItem = currentGroup?.items.find((i) => i.id === activeSection);

  const allItems = GROUPS.flatMap((g) => g.items);
  const currentIndex = allItems.findIndex((i) => i.id === activeSection);
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  const filteredGroups = searchQuery.trim()
    ? GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((group) => group.items.length > 0)
    : GROUPS;

  // Filterable search results for instant floating popover
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return SEARCHABLE_DOCS.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q) ||
        doc.keywords.some((kw) => kw.toLowerCase().includes(q))
      );
    });
  }, [searchQuery]);

  // Click outside to close search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cmd+K or Ctrl+K shortcut to focus search
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
    if (searchQuery.trim().length > 0) {
      setIsSearchOpen(true);
    }
  }, [searchQuery]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % searchResults.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        selectResult(searchResults[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const selectResult = (item: SearchableDoc) => {
    setActiveSection(item.id);
    setSearchQuery("");
    setIsSearchOpen(false);

    // Allow React state transition to complete before scrolling
    setTimeout(() => {
      if (item.anchor) {
        const el = document.getElementById(item.anchor);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
  };

  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      {/* ── Top Header / GitBook Breadcrumb & Search Banner ──────────────────── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2 text-xs font-mono text-foreground-muted">
          <Link href="/" className="hover:text-foreground transition-colors">ViperX</Link>
          <span>/</span>
          <span>{currentGroup?.title}</span>
          <span>/</span>
          <span className="text-foreground font-semibold">{currentItem?.label}</span>
          <span className="ml-2 inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold text-accent border border-accent/20">
            v1.0 Live
          </span>
        </div>

        {/* Search Bar - Instant Floating Popover */}
        <div ref={searchContainerRef} className="relative w-full sm:w-80 md:w-96">
          <div className="relative flex items-center">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search docs (e.g. Anchor, PnL)..."
              value={searchQuery}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setIsSearchOpen(true);
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="w-full h-10 pl-10 pr-14 text-xs font-mono rounded-xl border border-border bg-background/95 backdrop-blur-[2px] text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all shadow-sm"
            />
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted pointer-events-none z-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                    searchInputRef.current?.focus();
                  }}
                  className="text-foreground-faint hover:text-foreground text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-foreground-faint bg-surface rounded border border-border">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>

          {/* Instant Search Dropdown Popover */}
          <AnimatePresence>
            {isSearchOpen && searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 top-full mt-2 w-full sm:w-[480px] md:w-[540px] z-50 rounded-xl border border-border bg-background/95 backdrop-blur-[2px] shadow-2xl overflow-hidden"
              >
                {/* Result Info Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 text-[11px] font-mono text-foreground-faint bg-surface/40">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate max-w-[260px]">
                      "{searchQuery}"
                    </span>
                    <span>·</span>
                    <span className="text-foreground-muted">
                      {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                    </span>
                  </div>
                </div>

                {/* Results List */}
                <div className="max-h-[340px] overflow-y-auto p-1.5 space-y-1">
                  {searchResults.length > 0 ? (
                    searchResults.map((item, index) => {
                      const isSelected = index === selectedIndex;
                      return (
                        <button
                          key={`${item.id}-${item.title}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectResult(item);
                          }}
                          onClick={() => selectResult(item)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors cursor-pointer group ${
                            isSelected
                              ? "bg-surface text-foreground border border-border/80 shadow-sm"
                              : "hover:bg-surface/60 text-foreground-muted border border-transparent"
                          }`}
                        >
                          <div
                            className={`mt-0.5 h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-accent/15 text-accent"
                                : "bg-surface text-foreground-faint group-hover:text-foreground"
                            }`}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-foreground-faint">
                              <span>{item.group}</span>
                              <span>›</span>
                              <span className="text-foreground-muted">{item.category}</span>
                            </div>
                            <div className="font-semibold text-xs text-foreground mt-0.5 truncate">
                              <HighlightMatch text={item.title} query={searchQuery} />
                            </div>
                            <p className="text-[11px] text-foreground-muted line-clamp-1 mt-0.5 leading-normal">
                              <HighlightMatch text={item.description} query={searchQuery} />
                            </p>
                          </div>
                          <div
                            className={`shrink-0 self-center text-xs font-mono text-accent ${
                              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            ↵
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-8 px-4 text-center">
                      <p className="text-xs font-mono text-foreground-muted">
                        No documentation matching <span className="text-foreground font-semibold">"{searchQuery}"</span>
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                        <span className="text-[10px] font-mono text-foreground-faint">Suggestions:</span>
                        {["Base", "Solana", "Anchor", "PnL", "Anti-Gaming", "Oracles"].map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => {
                              setSearchQuery(term);
                              searchInputRef.current?.focus();
                            }}
                            className="px-2 py-0.5 rounded bg-surface hover:bg-surface-hover border border-border text-[10px] font-mono text-accent cursor-pointer"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Bar */}
                <div className="px-3.5 py-2 border-t border-border/50 bg-surface/30 flex items-center justify-between text-[10px] font-mono text-foreground-faint">
                  <div className="flex items-center gap-1.5">
                    <span>Filter:</span>
                    <span className="text-foreground-muted font-medium">All docs</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span><kbd className="px-1 py-0.5 bg-surface rounded border border-border text-[9px]">↑↓</kbd> Navigate</span>
                    <span><kbd className="px-1 py-0.5 bg-surface rounded border border-border text-[9px]">↵</kbd> Open</span>
                    <span><kbd className="px-1 py-0.5 bg-surface rounded border border-border text-[9px]">ESC</kbd> Close</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile TOC / Navigation Toggle (Hidden on Desktop) ──────────────── */}
      <div className="lg:hidden mb-6">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-xs font-mono text-foreground shadow-sm cursor-pointer ${
            mobileMenuOpen ? "border-accent/50 bg-surface/90 shadow-md" : "border-border bg-surface hover:border-border-strong"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-foreground-faint uppercase tracking-wider font-semibold text-[10px]">Jump to:</span>
            <span className="font-bold text-foreground">{currentItem?.label}</span>
          </div>
          <ChevronDownGlyph
            className={`h-4 w-4 text-foreground-muted transition-transform duration-200 ${
              mobileMenuOpen ? "rotate-180 text-accent" : ""
            }`}
          />
        </button>

        {mobileMenuOpen && (
          <div className="mt-2 p-3 rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-xl space-y-4">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-faint block mb-1">
                  {group.title}
                </span>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);
                        setMobileMenuOpen(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                        activeSection === item.id
                          ? "bg-surface text-foreground font-semibold border border-border"
                          : "text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Responsive Layout with Wide Middle Card & Slim Sidebars ──────── */}
      <div className="flex flex-col lg:flex-row gap-6 xl:gap-8 items-start w-full">
        {/* ── Column 1: Left Sticky Sidebar (Navigation Tree with Fluid Slider) ─ */}
        <aside className="hidden lg:flex lg:flex-col w-[220px] xl:w-[240px] shrink-0 sticky top-24 gap-6 p-4 rounded-xl bg-background/95 backdrop-blur-[2px]">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-accent uppercase tracking-wider font-semibold">
              DOCUMENTATION
            </span>
            <h2 className="text-sm font-bold text-foreground font-mono">ViperX Protocol</h2>
          </div>

          <nav className="flex flex-col gap-5 w-full">
            {filteredGroups.map((group, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 shrink-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-faint px-1">
                  {group.title}
                </span>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.id} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection(item.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={`w-full text-left font-mono text-xs py-2 px-3 rounded-lg cursor-pointer relative z-10 transition-colors ${
                          activeSection === item.id
                            ? "text-foreground font-bold"
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

          {/* Deployed Contract Links */}
          <div className="pt-4 border-t border-border/50 flex flex-col gap-1.5 font-mono text-[11px] text-foreground-faint">
            <a
              href="https://sepolia.basescan.org/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground flex items-center justify-between transition-colors group"
            >
              <span>Base Sepolia Scan</span>
              <ExternalLinkGlyph className="h-3.5 w-3.5 text-foreground-faint group-hover:text-foreground transition-colors" />
            </a>
            <a
              href="https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground flex items-center justify-between transition-colors group"
            >
              <span>Solana Devnet Explorer</span>
              <ExternalLinkGlyph className="h-3.5 w-3.5 text-foreground-faint group-hover:text-foreground transition-colors" />
            </a>
          </div>

          {/* Need Help? Block (from user design) */}
          <div className="pt-5 border-t border-border/50 flex flex-col gap-2 font-mono text-[11px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-faint">
              NEED HELP?
            </span>
            <p className="text-foreground-muted leading-relaxed font-sans text-xs">
              Have questions about contract integration or agent verification?
            </p>
            <div className="flex flex-col gap-2 mt-1">
              <a
                href="https://x.com/ViperX_site"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline flex items-center justify-between transition-colors font-medium group"
              >
                <span>Ask on X (@ViperX_site)</span>
                <ExternalLinkGlyph className="h-3.5 w-3.5 text-accent" />
              </a>
              <a
                href="https://github.com/ritesh59697/ViperX/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground-muted hover:text-foreground flex items-center justify-between transition-colors group"
              >
                <span>Report Issue</span>
                <ExternalLinkGlyph className="h-3.5 w-3.5 text-foreground-faint group-hover:text-foreground transition-colors" />
              </a>
            </div>
          </div>
        </aside>

        {/* ── Column 2: Center Main Reading Area (Hosted site style: seamless bg-background/95 backdrop-blur) ─ */}
        <main className="flex-1 min-w-0 w-full flex flex-col gap-8 bg-background/95 backdrop-blur-[2px] p-2 sm:p-4 rounded-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="w-full space-y-6"
            >
              {/* ── 1. INTRODUCTION ──────────────────────────────────────── */}
              {activeSection === "intro" && (
                <article className="space-y-6">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground font-mono tracking-tight">
                      Introduction
                    </h1>
                    <p className="t-body mt-4 text-foreground-muted leading-relaxed font-sans">
                      ViperX is a high-performance decentralized registry and trustless leaderboard 
                      for AI-powered trading agents. In social and copy trading, users frequently face 
                      information asymmetry: managers share curated screenshots or mock trades, hiding 
                      their actual historical performance and drawdowns. ViperX solves this by verifying 
                      every execution trace directly against on-chain transaction hashes and position history.
                    </p>
                  </div>

                  {/* GitBook Callout Info */}
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 flex gap-3 text-xs leading-relaxed font-mono">
                    <span className="text-base text-blue-400 shrink-0">ℹ</span>
                    <div>
                      <span className="font-bold text-blue-400 block mb-0.5">Trustless Verification</span>
                      <span className="text-foreground-muted font-sans text-xs">
                        All agent metrics (PnL, MDD, Sharpe) are verified on-chain against Base Sepolia and Solana Devnet block heights with zero client-side self-reporting.
                      </span>
                    </div>
                  </div>

                  <section id="verification-problem" className="pt-2">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono border-b border-border/60 pb-2.5">
                      The Verification Problem
                    </h2>
                    <p className="t-body mt-3 text-foreground-muted leading-relaxed font-sans">
                      Centralized trading stats are easy to spoof or manipulate. A manager can modify database 
                      records, run simultaneous opposing accounts to guarantee positive ROI on one, or selectively 
                      delete losing runs. By recording agent accounts to the blockchain, ViperX creates an 
                      immutable verification record. Every trade must connect to a verified account state and correspond 
                      to actual capital movements.
                    </p>
                  </section>

                  <section id="core-pillars" className="pt-2">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono border-b border-border/60 pb-2.5">
                      Core Design Pillars
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-3 mt-4">
                      <Card variant="muted" className="p-5 font-mono text-xs border border-border bg-surface/30">
                        <p className="font-semibold text-foreground text-sm">On-Chain Registry</p>
                        <p className="text-xs text-foreground-muted mt-2 leading-relaxed font-mono">
                          Agent configurations, ownership keys, and parameters are stored directly on the Base EVM and Solana SVM registries.
                        </p>
                      </Card>
                      <Card variant="muted" className="p-5 font-mono text-xs border border-border bg-surface/30">
                        <p className="font-semibold text-foreground text-sm">Verifiable Tracking</p>
                        <p className="text-xs text-foreground-muted mt-2 leading-relaxed font-mono">
                          Trades are indexed from blockchain events and cross-checked against raw on-chain account balances at each block.
                        </p>
                      </Card>
                      <Card variant="muted" className="p-5 font-mono text-xs border border-border bg-surface/30">
                        <p className="font-semibold text-foreground text-sm">Anti-Gaming Filters</p>
                        <p className="text-xs text-foreground-muted mt-2 leading-relaxed font-mono">
                          Automated statistics loops detect wash trading, round-tripping, and divergence between reported and executed trades.
                        </p>
                      </Card>
                    </div>
                  </section>
                </article>
              )}

              {/* ── 2. QUICK START ────────────────────────────────────────── */}
              {activeSection === "quickstart" && (
                <article className="space-y-6">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground font-mono tracking-tight">
                      Quick Start
                    </h1>
                    <p className="t-body mt-4 text-foreground-muted leading-relaxed font-sans">
                      Follow this guide to deploy your first quantitative trading agent and index its metrics.
                    </p>
                  </div>

                  <section id="prerequisites">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono border-b border-border/60 pb-2.5">
                      Prerequisites
                    </h2>
                    <p className="t-body mt-3 text-foreground-muted leading-relaxed font-sans">
                      Before initializing, ensure your browser wallet is funded with testnet gas and collateral:
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 mt-4 font-mono text-xs">
                      <div className="p-4 rounded-xl border border-border bg-surface/30">
                        <span className="font-bold text-foreground block mb-1 text-sm">Base Sepolia</span>
                        <span className="text-foreground-muted text-xs leading-relaxed">
                          Funded with Sepolia ETH for gas, plus testnet USDC to seed the initial trade vault.
                        </span>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-surface/30">
                        <span className="font-bold text-foreground block mb-1 text-sm">Solana Devnet</span>
                        <span className="text-foreground-muted text-xs leading-relaxed">
                          Funded with at least 0.2 Devnet SOL to rent space for the Agent Registry PDA account.
                        </span>
                      </div>
                    </div>
                  </section>

                  <section id="step-1" className="space-y-4 pt-2">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono border-b border-border/60 pb-2.5">
                      Step-by-Step Setup
                    </h2>
                    <div className="flex flex-col gap-6 mt-4 font-mono text-xs">
                      <div className="flex gap-4">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground font-sans">1</span>
                        <div>
                          <p className="font-bold text-foreground text-sm">Select a Strategy Template</p>
                          <p className="text-xs text-foreground-muted mt-1 leading-relaxed font-sans">
                            Navigate to the <Link href="/create" className="text-accent hover:underline">Deploy Agent</Link> page. Choose a strategy template (Trend Following, RSI Mean Reversion, or Grid Market Maker) to prefill the strategy URI and bounds.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground font-sans">2</span>
                        <div>
                          <p className="font-bold text-foreground text-sm">Define Parameters & Collateral</p>
                          <p className="text-xs text-foreground-muted mt-1 leading-relaxed font-sans">
                            Set a unique Agent ID and descriptive name. Specify the vault public address where trading collateral will reside, and authorize delegated execution access to the runtime keys.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground font-sans">3</span>
                        <div>
                          <p className="font-bold text-foreground text-sm">Authorize Transaction</p>
                          <p className="text-xs text-foreground-muted mt-1 leading-relaxed font-sans">
                            Sign the deployment transaction. This logs mappings to the Base contract or allocates storage accounts on Solana. Once confirmed, the indexer starts tracking trades automatically.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </article>
              )}

              {/* ── 3. SYSTEM ARCHITECTURE ────────────────────────────────── */}
              {activeSection === "architecture" && (
                <article className="space-y-6">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground font-mono tracking-tight">
                      System Architecture
                    </h1>
                    <p className="t-body mt-4 text-foreground-muted leading-relaxed font-sans">
                      The ViperX protocol is composed of three interconnected layers: on-chain smart contracts (Registry), off-chain log scanners (Indexer), and the web client.
                    </p>
                  </div>

                  <section id="layer-overview">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono border-b border-border/60 pb-2.5">
                      Three-Tier Protocol Diagram
                    </h2>

                    {/* Visual Architecture Diagram (No Emojis, Pure SVG Connectors) */}
                    <div className="mt-6 flex flex-col items-center w-full max-w-2xl mx-auto font-mono">
                      {/* Tier 1: Client Layer */}
                      <div className="w-full rounded-xl border border-border bg-surface/50 p-4 shadow-xs">
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-accent" />
                            <span className="text-xs font-bold text-foreground tracking-wider uppercase">
                              Client Layer
                            </span>
                          </div>
                          <span className="text-[10px] text-foreground-faint rounded bg-surface px-2 py-0.5 border border-border/60">
                            Tier 01 · Frontend
                          </span>
                        </div>
                        <p className="mt-2.5 text-xs text-foreground font-medium">
                          Next.js 16 WebApp · RainbowKit (Base EVM) · Solana Wallet Adapter
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-foreground-muted">
                          <span className="rounded bg-background/80 px-2 py-0.5 border border-border/50">App Router</span>
                          <span className="rounded bg-background/80 px-2 py-0.5 border border-border/50">Turbopack</span>
                          <span className="rounded bg-background/80 px-2 py-0.5 border border-border/50">wagmi / viem</span>
                          <span className="rounded bg-background/80 px-2 py-0.5 border border-border/50">@solana/web3.js</span>
                        </div>
                      </div>

                      {/* Arrow Connector 1 -> 2 */}
                      <div className="flex justify-center my-2">
                        <svg width="20" height="24" viewBox="0 0 20 24" fill="none" className="text-border-strong">
                          <path d="M10 0V20M10 20L5 14M10 20L15 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>

                      {/* Tier 2: Consensus & Indexer */}
                      <div className="w-full rounded-xl border border-border bg-surface/50 p-4 shadow-xs">
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            <span className="text-xs font-bold text-foreground tracking-wider uppercase">
                              Consensus Indexer & Oracles
                            </span>
                          </div>
                          <span className="text-[10px] text-foreground-faint rounded bg-surface px-2 py-0.5 border border-border/60">
                            Tier 02 · Service
                          </span>
                        </div>
                        <p className="mt-2.5 text-xs text-foreground font-medium">
                          Fastify Runtime · Pyth Network Price Feeds · Anti-Gaming Scanners
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-foreground-muted">
                          <span className="rounded bg-background/80 px-2 py-0.5 border border-border/50">Sub-Second Poller</span>
                          <span className="rounded bg-background/80 px-2 py-0.5 border border-border/50">Real-Time PnL Reconciliation</span>
                          <span className="rounded bg-background/80 px-2 py-0.5 border border-border/50">Wash-Trading Filter</span>
                        </div>
                      </div>

                      {/* Forked Arrow Connector 2 -> 3 (Split into Base & Solana) */}
                      <div className="w-full flex justify-around my-2 px-12">
                        <div className="flex flex-col items-center">
                          <svg width="18" height="24" viewBox="0 0 18 24" fill="none" className="text-border-strong">
                            <path d="M9 0V20M9 20L4 14M9 20L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-[9px] text-foreground-faint mt-0.5 font-mono">EVM</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <svg width="18" height="24" viewBox="0 0 18 24" fill="none" className="text-border-strong">
                            <path d="M9 0V20M9 20L4 14M9 20L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-[9px] text-foreground-faint mt-0.5 font-mono">SVM</span>
                        </div>
                      </div>

                      {/* Tier 3: Dual-Chain Smart Contract Registries */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        {/* Base Sepolia Card */}
                        <div className="rounded-xl border border-border bg-surface/50 p-4 shadow-xs">
                          <div className="flex items-center justify-between gap-1 border-b border-border/60 pb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              <span className="text-xs font-bold text-foreground">Base Sepolia</span>
                            </div>
                            <span className="text-[9px] font-mono text-foreground-faint">84532</span>
                          </div>
                          <ul className="mt-2.5 space-y-1 text-[11px] text-foreground-muted font-mono">
                            <li className="flex items-center gap-1">
                              <span className="text-blue-400">›</span>
                              <span>ViperxRegistry.sol</span>
                            </li>
                            <li className="flex items-center gap-1">
                              <span className="text-blue-400">›</span>
                              <span>ViperPerp.sol</span>
                            </li>
                            <li className="flex items-center gap-1">
                              <span className="text-blue-400">›</span>
                              <span>PythPriceAdapter.sol</span>
                            </li>
                          </ul>
                        </div>

                        {/* Solana Devnet Card */}
                        <div className="rounded-xl border border-border bg-surface/50 p-4 shadow-xs">
                          <div className="flex items-center justify-between gap-1 border-b border-border/60 pb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-purple-500" />
                              <span className="text-xs font-bold text-foreground">Solana Devnet</span>
                            </div>
                            <span className="text-[9px] font-mono text-foreground-faint">Devnet</span>
                          </div>
                          <ul className="mt-2.5 space-y-1 text-[11px] text-foreground-muted font-mono">
                            <li className="flex items-center gap-1">
                              <span className="text-purple-400">›</span>
                              <span>viperx_registry</span>
                            </li>
                            <li className="flex items-center gap-1">
                              <span className="text-purple-400">›</span>
                              <span>Agent PDA Accounts</span>
                            </li>
                            <li className="flex items-center gap-1">
                              <span className="text-purple-400">›</span>
                              <span>Velocity Perp Stream</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section id="layer-specs" className="pt-2">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono border-b border-border/60 pb-2.5">
                      Layer Specifications
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 mt-4 font-mono text-xs">
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
                        <div key={i} className="flex flex-col gap-2 bg-surface/30 border border-border rounded-xl p-4">
                          <h3 className="font-bold text-accent uppercase tracking-wider text-[11px]">{col.group}</h3>
                          <div className="flex flex-col gap-1 text-foreground-muted text-[11px]">
                            {col.items.map((item, j) => (
                              <div key={j} className="flex items-center gap-1.5">
                                <span>└─</span>
                                <span className="truncate">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </article>
              )}

              {/* ── 4. SOLANA SVM PROGRAM ──────────────────────────────────── */}
              {activeSection === "solana-program" && (
                <article className="space-y-6">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground font-mono tracking-tight">
                      Solana SVM Program
                    </h1>
                    <p className="t-body mt-4 text-foreground-muted leading-relaxed font-sans">
                      On Solana, registry data is managed by an Anchor program deployed to Devnet at address:
                    </p>
                    <div className="mt-3 p-3 rounded-lg border border-border bg-surface/40 font-mono text-xs flex items-center justify-between">
                      <span className="text-foreground font-bold truncate">321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm</span>
                      <button
                        onClick={() => handleCopy("321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm", "sol-prog")}
                        className="text-foreground-faint hover:text-foreground text-[11px] ml-2 shrink-0 cursor-pointer"
                      >
                        {copiedCode === "sol-prog" ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <section id="account-structure">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono border-b border-border/60 pb-2.5">
                      Account Structure
                    </h2>
                    <p className="t-body mt-3 text-foreground-muted leading-relaxed font-sans">
                      Every agent is initialized as a Program Derived Address (PDA) using seed formatting to guarantee uniqueness:
                      <br />
                      <code className="font-mono text-foreground font-bold text-xs">seeds = [b"agent", owner_pubkey, agent_id_bytes]</code>.
                    </p>
                  </section>

                  <section id="anchor-code">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono">
                        Rust Anchor Code Specification
                      </h2>
                      <button
                        onClick={() => handleCopy(`#[program]
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
}`, "sol-code")}
                        className="text-xs font-mono text-foreground-muted hover:text-foreground cursor-pointer"
                      >
                        {copiedCode === "sol-code" ? "✓ Copied Code!" : "Copy Rust"}
                      </button>
                    </div>
                    <pre className="mt-4 p-4 rounded-xl bg-surface/40 border border-border font-mono text-[11px] text-foreground-muted overflow-x-auto leading-relaxed">
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
                  </section>
                </article>
              )}

              {/* ── 5. BASE EVM REGISTRY ─────────────────────────────────── */}
              {activeSection === "base-contract" && (
                <article className="space-y-6">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground font-mono tracking-tight">
                      Base EVM Registry
                    </h1>
                    <p className="t-body mt-4 text-foreground-muted leading-relaxed font-sans">
                      The EVM registry is a Solidity contract deployed on Base Sepolia. It manages unique string ID lookups 
                      pointing to agent parameters and owner addresses:
                    </p>
                    <div className="mt-3 p-3 rounded-lg border border-border bg-surface/40 font-mono text-xs flex items-center justify-between">
                      <span className="text-foreground font-bold truncate">0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee</span>
                      <button
                        onClick={() => handleCopy("0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee", "base-addr")}
                        className="text-foreground-faint hover:text-foreground text-[11px] ml-2 shrink-0 cursor-pointer"
                      >
                        {copiedCode === "base-addr" ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <section id="evm-architecture">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono">
                        Solidity Smart Contract Implementation
                      </h2>
                      <button
                        onClick={() => handleCopy(`// SPDX-License-Identifier: MIT
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
}`, "sol-reg")}
                        className="text-xs font-mono text-foreground-muted hover:text-foreground cursor-pointer"
                      >
                        {copiedCode === "sol-reg" ? "✓ Copied Code!" : "Copy Solidity"}
                      </button>
                    </div>
                    <pre className="mt-4 p-4 rounded-xl bg-surface/40 border border-border font-mono text-[11px] text-foreground-muted overflow-x-auto leading-relaxed">
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
                  </section>
                </article>
              )}

              {/* ── 6. PNL INDEXER ────────────────────────────────────────── */}
              {activeSection === "indexer" && (
                <article className="space-y-6">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground font-mono tracking-tight">
                      PnL Indexer
                    </h1>
                    <p className="t-body mt-4 text-foreground-muted leading-relaxed font-sans">
                      The background indexer polls block events and transaction traces from the blockchain. 
                      Instead of trusting self-reported numbers, the indexer queries oracle values (Pyth/Chainlink) at the exact transaction block height.
                    </p>
                  </div>

                  <section id="pipeline">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono border-b border-border/60 pb-2.5">
                      Reconciliation Pipeline
                    </h2>
                    <div className="flex flex-col gap-4 mt-4 font-mono text-xs text-foreground-muted">
                      <div className="border border-border p-5 rounded-xl bg-surface/30">
                        <p className="font-semibold text-foreground text-sm">1. Trade Collection</p>
                        <p className="text-xs mt-1.5 font-sans leading-relaxed">The execution runtime self-reports trading activity, writing transactions to the database. These records are initially marked as pending verification.</p>
                      </div>
                      <div className="border border-border p-5 rounded-xl bg-surface/30">
                        <p className="font-semibold text-foreground text-sm">2. Position Monitoring</p>
                        <p className="text-xs mt-1.5 font-sans leading-relaxed">Independent indexer loops monitor trade collateral vaults. For Base, it tracks ViperVault position states and Pyth updates. For Solana, it polls Velocity perp positions.</p>
                      </div>
                      <div className="border border-border p-5 rounded-xl bg-surface/30">
                        <p className="font-semibold text-foreground text-sm">3. Settlement Verification</p>
                        <p className="text-xs mt-1.5 font-sans leading-relaxed">When a position close is observed, the indexer fetches Pyth price feeds at that timestamp, computes realized returns, and reconciles the results.</p>
                      </div>
                    </div>
                  </section>
                </article>
              )}

              {/* ── 7. ANTI-GAMING HEURISTICS ──────────────────────────────── */}
              {activeSection === "anti-gaming" && (
                <article className="space-y-6">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground font-mono tracking-tight">
                      Anti-Gaming Heuristics
                    </h1>
                    <p className="t-body mt-4 text-foreground-muted leading-relaxed font-sans">
                      A ranked agent requires a minimum of 50 verified fills. In addition, our heuristics check trade history to flag synthetic volume.
                    </p>
                  </div>

                  <section id="heuristics-overview">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground font-mono border-b border-border/60 pb-2.5">
                      Heuristics Verification System
                    </h2>
                    <p className="t-body mt-3 text-foreground-muted leading-relaxed font-sans">
                      ViperX runs statistical scans across transaction history to block exploitation attempts:
                    </p>

                    <div className="space-y-4 mt-6 font-mono text-xs">
                      <div className="flex gap-4 items-start border-l-2 border-accent pl-4">
                        <div>
                          <p className="font-bold text-foreground text-sm">Wash Trading Detection</p>
                          <p className="text-xs text-foreground-muted mt-1 leading-relaxed font-sans">
                            Flags accounts that execute rapid offsetting trades (e.g. buying and selling the same contract within short intervals) to inflate transaction metrics without holding real exposure.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 items-start border-l-2 border-accent pl-4">
                        <div>
                          <p className="font-bold text-foreground text-sm">Circular Hedging Verification</p>
                          <p className="text-xs text-foreground-muted mt-1 leading-relaxed font-sans">
                            Compares correlation between separate registered wallets. Flags instances where Wallet A goes long and Wallet B goes short simultaneously to create artificially low-risk return stats.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 items-start border-l-2 border-accent pl-4">
                        <div>
                          <p className="font-bold text-foreground text-sm">PnL Divergence Checking</p>
                          <p className="text-xs text-foreground-muted mt-1 leading-relaxed font-sans">
                            Matches reported execution-runtime returns with actual on-chain collateral increases. If divergence exceeds the $0.50 threshold, the trade is flagged for review.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </article>
              )}

              {/* ── GitBook Previous / Next Pagination Cards ──────────────── */}
              <div className="pt-8 border-t border-border mt-8 grid gap-4 sm:grid-cols-2">
                {prevItem ? (
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]">
                    <button
                      onClick={() => {
                        setActiveSection(prevItem.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full h-full p-4 rounded-lg bg-white dark:bg-[#0a0a0a] text-left cursor-pointer group"
                    >
                      <span className="text-[10px] font-mono uppercase tracking-wider text-foreground-faint block mb-1">
                        ← Previous Chapter
                      </span>
                      <span className="text-xs font-bold text-foreground font-mono group-hover:text-accent transition-colors">
                        {prevItem.label}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div />
                )}

                {nextItem ? (
                  <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 transition-all duration-200 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838] sm:col-start-2">
                    <button
                      onClick={() => {
                        setActiveSection(nextItem.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full h-full p-4 rounded-lg bg-white dark:bg-[#0a0a0a] text-right cursor-pointer group"
                    >
                      <span className="text-[10px] font-mono uppercase tracking-wider text-foreground-faint mb-1 flex items-center justify-end gap-1">
                        <span>Next Chapter</span>
                        <ArrowRightGlyph className="h-3 w-3" />
                      </span>
                      <span className="text-xs font-bold text-foreground font-mono group-hover:text-accent transition-colors">
                        {nextItem.label}
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>

              {/* ── GitBook Feedback Footer ──────────────────────────────── */}
              <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-foreground-faint">
                <div className="flex items-center gap-2">
                  <span>Was this page helpful?</span>
                  <button
                    onClick={() => setFeedbackGiven("yes")}
                    className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                      feedbackGiven === "yes"
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 font-bold"
                        : "border-border hover:text-foreground"
                    }`}
                  >
                    👍 Yes
                  </button>
                  <button
                    onClick={() => setFeedbackGiven("no")}
                    className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                      feedbackGiven === "no"
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold"
                        : "border-border hover:text-foreground"
                    }`}
                  >
                    👎 No
                  </button>
                  {feedbackGiven && <span className="text-emerald-400 text-[10px] ml-1">Thank you!</span>}
                </div>

                <a
                  href="https://github.com/ritesh59697/ViperX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <span>Edit page on GitHub</span>
                  <ExternalLinkGlyph className="h-3 w-3 opacity-70" />
                </a>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </Section>
  );
}
