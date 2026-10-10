"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export interface Skiper92Item {
  id: string;
  category: "suggestions" | "pages" | "agents" | "strategies" | "docs" | "settings";
  title: string;
  subtitle?: string;
  href: string;
  external?: boolean;
  icon?: React.ReactNode;
  shortcut?: string;
  badge?: string;
}

interface AgentApiItem {
  agent_pda: string;
  name?: string;
  agent_id: string;
  chain?: string;
  trade_count: string | number;
  sharpe_like?: string | number | null;
  rank?: number | null;
}

const DEFAULT_ITEMS: Skiper92Item[] = [
  // Suggestions (Top Priority)
  {
    id: "sug-leaderboard",
    category: "suggestions",
    title: "Leaderboard",
    subtitle: "Explore verified on-chain Sharpe rankings and track records",
    href: "/leaderboard",
    shortcut: "⌘L",
    badge: "Verified",
  },
  {
    id: "sug-arena",
    category: "suggestions",
    title: "Arena Seasons",
    subtitle: "Head-to-head trading agent competition and leaderboard",
    href: "/arena",
    shortcut: "⌘A",
    badge: "Live",
  },
  {
    id: "sug-deploy",
    category: "suggestions",
    title: "Deploy Agent",
    subtitle: "Launch a quantitative agent on OKX X Layer or Solana Devnet",
    href: "/create",
    shortcut: "⌘D",
    badge: "Create",
  },

  // Pages
  {
    id: "page-dashboard",
    category: "pages",
    title: "Portfolio Dashboard",
    subtitle: "Manage your deployed agents, vaults, and positions",
    href: "/dashboard",
  },
  {
    id: "page-backtest",
    category: "pages",
    title: "Backtest Lab",
    subtitle: "Simulate strategies against historical market data",
    href: "/backtest",
  },
  {
    id: "page-paper",
    category: "pages",
    title: "Paper Trading",
    subtitle: "Virtual capital trading simulation with live price feeds",
    href: "/paper",
  },

  // Strategies
  {
    id: "strat-momentum",
    category: "strategies",
    title: "Momentum Surfer",
    subtitle: "Multi-timeframe trend following on SOL & ETH",
    href: "/backtest?strategy=momentum",
    badge: "Trend",
  },
  {
    id: "strat-mean-reversion",
    category: "strategies",
    title: "Mean Reversion",
    subtitle: "Statistical arbitrage on volatility band extensions",
    href: "/backtest?strategy=mean-reversion",
    badge: "Quant",
  },
  {
    id: "strat-funding-arb",
    category: "strategies",
    title: "Funding Rate Arbitrage",
    subtitle: "Delta-neutral yield harvesting across perp venues",
    href: "/backtest?strategy=funding-arb",
  },

  // Documentation
  {
    id: "doc-docs",
    category: "docs",
    title: "Protocol Documentation",
    subtitle: "ViperX core architecture and proof specifications",
    href: "https://docs.viperx.site",
    external: true,
    shortcut: "Docs ↗",
  },
  {
    id: "doc-specs",
    category: "docs",
    title: "Smart Contracts & Specs",
    subtitle: "OKX X Layer ViperVault and Solana Anchor program verification",
    href: "https://docs.viperx.site/security/smart-contracts",
    external: true,
    shortcut: "Specs ↗",
  },
  {
    id: "doc-quickstart",
    category: "docs",
    title: "Agent Developer Quickstart",
    subtitle: "Integration guide for autonomous trading loops",
    href: "https://docs.viperx.site/quickstart",
    external: true,
    shortcut: "Guide ↗",
  },
];

const CATEGORY_ORDER = ["suggestions", "pages", "agents", "strategies", "docs"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  suggestions: "Suggestions",
  pages: "Pages & Tools",
  agents: "Trading Agents",
  strategies: "Strategies",
  docs: "Documentation",
};

interface Skiper92Props {
  isOpen: boolean;
  onClose: () => void;
  items?: Skiper92Item[];
}

/**
 * Skiper92: Vercel Command Search Palette with layout animations,
 * keyboard navigation, and full Light Mode + Dark Mode support.
 */
export function Skiper92CommandDialog({
  isOpen,
  onClose,
  items = DEFAULT_ITEMS,
}: Skiper92Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dynamicAgents, setDynamicAgents] = useState<Skiper92Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-fetch top live agents from database when opened
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    fetch("/api/leaderboard?window=all")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !data?.agents) return;
        const agents: Skiper92Item[] = (data.agents as AgentApiItem[]).slice(0, 6).map((a) => ({
          id: `agent-${a.agent_pda}`,
          category: "agents" as const,
          title: a.name || a.agent_id,
          subtitle: `${a.chain === "base" || a.agent_pda.startsWith("0x") ? "OKX X Layer" : "Solana"} · ${a.trade_count} trades · Sharpe ${a.sharpe_like ?? "N/A"}`,
          href: `/agents/${a.agent_pda}`,
          badge: a.rank ? `#${a.rank}` : "Unranked",
        }));
        setDynamicAgents(agents);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Combined searchable item list
  const combinedItems = useMemo(() => {
    return [...items, ...dynamicAgents];
  }, [items, dynamicAgents]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return combinedItems;
    return combinedItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [query, combinedItems]);

  const grouped = useMemo(() => {
    const map = new Map<string, Skiper92Item[]>();
    for (const cat of CATEGORY_ORDER) {
      const matches = filteredItems.filter((i) => i.category === cat);
      if (matches.length > 0) {
        map.set(cat, matches);
      }
    }
    return map;
  }, [filteredItems]);

  const flatVisibleItems = useMemo(() => {
    const list: Skiper92Item[] = [];
    for (const groupItems of grouped.values()) {
      list.push(...groupItems);
    }
    return list;
  }, [grouped]);

  const handleSelect = useCallback((item: Skiper92Item) => {
    onClose();
    if (item.external) {
      window.open(item.href, "_blank", "noopener,noreferrer");
    } else {
      router.push(item.href);
    }
  }, [onClose, router]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedIndex(0);
  };

  // Keyboard navigation: Arrows, Enter, Escape
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, flatVisibleItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flatVisibleItems.length) % Math.max(1, flatVisibleItems.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const active = flatVisibleItems[selectedIndex];
        if (active) handleSelect(active);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, flatVisibleItems, selectedIndex, handleSelect, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] sm:pt-[14vh] px-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Vercel Command Dialog (Skiper92) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className="relative w-full max-w-[540px] overflow-hidden rounded-2xl border border-border/80 bg-[var(--background-elevated-solid,#ffffff)] dark:bg-[#0c0d10] text-foreground shadow-2xl dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
          >
            {/* Input Header */}
            <div className="relative flex items-center border-b border-border/70 dark:border-white/[0.08] px-4 py-3.5">
              {/* Search Icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-foreground-faint"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Find..."
                className="ml-3 flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-foreground-faint/60 focus:outline-none"
              />

              {/* Esc Badge */}
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 rounded-md border border-border/80 dark:border-white/10 bg-surface dark:bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                Esc
              </button>
            </div>

            {/* Results Container */}
            <div
              ref={listRef}
              className="max-h-[380px] overflow-y-auto overscroll-contain p-2 font-sans scrollbar-thin scrollbar-thumb-border/50"
            >
              {flatVisibleItems.length === 0 ? (
                <div className="py-10 text-center font-mono text-xs text-foreground-faint">
                  No matching results for &ldquo;{query}&rdquo;
                </div>
              ) : (
                Array.from(grouped.entries()).map(([cat, catItems]) => (
                  <div key={cat} className="mb-2 last:mb-0">
                    <div className="px-3 pt-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-faint">
                      {CATEGORY_LABELS[cat] || cat}
                    </div>

                    <div className="space-y-0.5">
                      {catItems.map((item) => {
                        const globalIndex = flatVisibleItems.indexOf(item);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={cn(
                              "group relative flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer select-none",
                              isSelected ? "text-foreground" : "text-foreground-muted hover:text-foreground"
                            )}
                          >
                            {/* Animated Background Pill with layoutId */}
                            {isSelected && (
                              <motion.div
                                layoutId="skiper92-active-pill"
                                className="absolute inset-0 rounded-xl bg-[hsl(0,72%,51%)]/10 dark:bg-[hsl(0,72%,51%)]/15 border border-[hsl(0,72%,51%)]/30 dark:border-[hsl(0,72%,51%)]/25"
                                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                              />
                            )}

                            {/* Left Side: Arrow + Title + Subtitle */}
                            <div className="relative z-10 flex items-center gap-2.5 min-w-0 flex-1">
                              <span className={cn(
                                "shrink-0 transition-transform duration-200 text-foreground-faint group-hover:text-foreground",
                                isSelected ? "text-[hsl(0,72%,51%)] translate-x-0.5" : ""
                              )}>
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </span>

                              <div className="flex flex-col truncate">
                                <span className="font-medium text-[13px] leading-snug truncate">
                                  {item.title}
                                </span>
                                {item.subtitle && (
                                  <span className="text-[11px] text-foreground-faint truncate leading-tight mt-0.5">
                                    {item.subtitle}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right Side: Badge / Shortcut */}
                            <div className="relative z-10 flex items-center gap-1.5 shrink-0 ml-3">
                              {item.badge && (
                                <span className="rounded-md border border-border/70 dark:border-white/10 bg-surface dark:bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-foreground-faint">
                                  {item.badge}
                                </span>
                              )}
                              {item.shortcut && (
                                <kbd className="rounded border border-border/80 dark:border-white/10 bg-surface dark:bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-foreground-faint">
                                  {item.shortcut}
                                </kbd>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Status Bar */}
            <div className="flex items-center justify-between border-t border-border/70 dark:border-white/[0.08] bg-surface/30 dark:bg-white/[0.02] px-4 py-2 font-mono text-[10px] text-foreground-faint">
              <div className="flex items-center gap-2">
                <span>Navigate <kbd className="font-sans">↑↓</kbd></span>
                <span>•</span>
                <span>Select <kbd className="font-sans">↵</kbd></span>
              </div>
              <div>
                <span>Press <kbd className="font-sans">F</kbd> to search anytime</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Skiper92 Header Search Trigger Button:
 * The minimalist, modern search pill with glowing hover and keyboard badge.
 */
export function Skiper92HeaderTrigger({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-full border border-border/80 dark:border-white/12 bg-background-elevated dark:bg-white/[0.04] px-3.5 py-1.5 text-xs text-foreground-muted hover:border-border-strong dark:hover:border-white/25 hover:text-foreground hover:bg-surface-hover dark:hover:bg-white/[0.07] transition-all duration-200 cursor-pointer shadow-2xs select-none",
        className
      )}
      title="Search (⌘K or F)"
      aria-label="Open search dialog"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground-faint group-hover:text-foreground transition-colors"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span className="font-sans text-xs font-medium text-foreground-muted group-hover:text-foreground transition-colors">
        Find...
      </span>
      <kbd className="inline-flex items-center rounded border border-border/80 dark:border-white/10 bg-background dark:bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-foreground-faint group-hover:text-foreground-muted transition-colors">
        ⌘K
      </kbd>
    </button>
  );
}

export default Skiper92CommandDialog;
