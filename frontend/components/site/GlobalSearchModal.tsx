"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface SearchItem {
  id: string;
  category: "agents" | "pages" | "strategies" | "docs";
  title: string;
  subtitle: string;
  href: string;
  external?: boolean;
  badge?: string;
  badgeType?: "accent" | "positive" | "warning" | "default";
}

const STATIC_SEARCH_ITEMS: SearchItem[] = [
  // Pages & Tools
  {
    id: "nav-leaderboard",
    category: "pages",
    title: "Leaderboard",
    subtitle: "Real-time rankings based on independently verified on-chain PnL",
    href: "/leaderboard",
    badge: "Live Rankings",
    badgeType: "positive",
  },
  {
    id: "nav-arena",
    category: "pages",
    title: "Arena (Season 1)",
    subtitle: "Compete in live trading seasons, climb divisions, and win pool prizes",
    href: "/arena",
    badge: "Season 1",
    badgeType: "accent",
  },
  {
    id: "nav-deploy",
    category: "pages",
    title: "Deploy Agent",
    subtitle: "Launch a verifiable quantitative AI trading agent on Base Sepolia or Solana Devnet",
    href: "/create",
    badge: "Launch",
    badgeType: "accent",
  },
  {
    id: "nav-trade",
    category: "pages",
    title: "Trading Terminal",
    subtitle: "Execute manual or automated trades against verified order books",
    href: "/trade",
    badge: "Terminal",
    badgeType: "default",
  },
  {
    id: "nav-backtest",
    category: "pages",
    title: "Backtest Lab",
    subtitle: "Stress test custom algorithmic strategies against historical tick data",
    href: "/backtest",
    badge: "Lab",
    badgeType: "default",
  },
  {
    id: "nav-paper",
    category: "pages",
    title: "Paper Trading",
    subtitle: "Zero-risk live market simulations with real-time Binance price feeds",
    href: "/paper",
    badge: "Simulation",
    badgeType: "warning",
  },
  {
    id: "nav-dashboard",
    category: "pages",
    title: "Portfolio Dashboard",
    subtitle: "Manage your deployed agents, monitor performance, and tune weights",
    href: "/dashboard",
    badge: "Personal",
    badgeType: "default",
  },

  // Strategies
  {
    id: "strat-momentum",
    category: "strategies",
    title: "Momentum Surfer",
    subtitle: "Trend-following strategy leveraging multi-timeframe EMA crosses and volume spikes",
    href: "/backtest?strategy=momentum",
    badge: "Strategy",
    badgeType: "accent",
  },
  {
    id: "strat-mean-reversion",
    category: "strategies",
    title: "Mean Reversion",
    subtitle: "Statistical arbitrage exploiting Bollinger Band and RSI divergence overextensions",
    href: "/backtest?strategy=mean-reversion",
    badge: "Strategy",
    badgeType: "accent",
  },
  {
    id: "strat-breakout",
    category: "strategies",
    title: "Breakout Hunter",
    subtitle: "High-volatility intraday breakout capture on key resistance / support breaches",
    href: "/backtest?strategy=breakout",
    badge: "Strategy",
    badgeType: "accent",
  },
  {
    id: "strat-grid",
    category: "strategies",
    title: "Grid Scalper",
    subtitle: "High-frequency micro-spread market making across ranging consolidation channels",
    href: "/backtest?strategy=grid",
    badge: "Strategy",
    badgeType: "accent",
  },
  {
    id: "strat-funding-arb",
    category: "strategies",
    title: "Funding Rate Arbitrage",
    subtitle: "Delta-neutral yield harvesting exploiting perp vs spot funding rate discrepancies",
    href: "/backtest?strategy=funding-arb",
    badge: "Strategy",
    badgeType: "accent",
  },

  // Docs & Technical Specs
  {
    id: "doc-overview",
    category: "docs",
    title: "Protocol Documentation",
    subtitle: "ViperX core protocol architecture, verification proofs, and security models",
    href: "https://docs.viperx.site",
    external: true,
    badge: "Docs",
    badgeType: "default",
  },
  {
    id: "doc-specs",
    category: "docs",
    title: "Smart Contracts & Specs",
    subtitle: "Deployed Base Sepolia registry and Solana Devnet program verification",
    href: "https://docs.viperx.site/security/smart-contracts",
    external: true,
    badge: "Contracts",
    badgeType: "default",
  },
  {
    id: "doc-quickstart",
    category: "docs",
    title: "Agent Developer Quickstart",
    subtitle: "Step-by-step walkthrough to connect and deploy your first trading agent",
    href: "https://docs.viperx.site/quickstart",
    external: true,
    badge: "Guides",
    badgeType: "default",
  },
  {
    id: "doc-anti-gaming",
    category: "docs",
    title: "Anti-Wash-Trading Proof Engine",
    subtitle: "Deterministic on-chain velocity checks preventing synthetic volume inflation",
    href: "https://docs.viperx.site/architecture/anti-gaming",
    external: true,
    badge: "Security",
    badgeType: "warning",
  },
  {
    id: "doc-solana-program",
    category: "docs",
    title: "Solana Devnet Program: 321hJ..QVRm",
    subtitle: "Inspect Solana on-chain anchor program transactions on Solana Explorer",
    href: "https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet",
    external: true,
    badge: "Solana",
    badgeType: "default",
  },
  {
    id: "doc-base-contract",
    category: "docs",
    title: "Base Sepolia Registry: 0xA25..C7ee",
    subtitle: "Inspect Base Sepolia smart contract verification on Basescan",
    href: "https://sepolia.basescan.org/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee",
    external: true,
    badge: "Base",
    badgeType: "default",
  },
];

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "agents" | "pages" | "strategies" | "docs">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dynamicAgents, setDynamicAgents] = useState<SearchItem[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch agents once when search opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadAgents() {
      if (dynamicAgents.length > 0) return;
      setLoadingAgents(true);
      try {
        const res = await fetch("/api/leaderboard?window=all");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data?.agents && Array.isArray(data.agents)) {
          const formatted: SearchItem[] = data.agents.map((agent: {
            agent_pda: string;
            name: string;
            agent_id: string;
            trade_count: string;
            roi_pct: string | null;
            onchain_verified: boolean;
            is_paper?: boolean;
          }) => ({
            id: `agent-${agent.agent_pda}`,
            category: "agents",
            title: agent.name || "Unnamed Agent",
            subtitle: `${agent.agent_id.trim()} · ${agent.trade_count} trades · ROI: ${
              agent.roi_pct != null ? `${Number(agent.roi_pct).toFixed(1)}%` : "N/A"
            }`,
            href: `/agents/${agent.agent_pda}`,
            badge: agent.is_paper ? "Paper" : agent.onchain_verified ? "Verified" : "Registered",
            badgeType: agent.is_paper ? "warning" : agent.onchain_verified ? "positive" : "default",
          }));
          setDynamicAgents(formatted);
        }
      } catch (err) {
        console.error("Failed to fetch agents for search:", err);
      } finally {
        if (isMounted) setLoadingAgents(false);
      }
    }

    loadAgents();

    // Auto-focus search input with small timeout to allow modal animation
    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 40);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [isOpen, dynamicAgents.length]);

  // Combine static and dynamic items
  const allItems = useMemo(() => {
    return [...dynamicAgents, ...STATIC_SEARCH_ITEMS];
  }, [dynamicAgents]);

  // Filter items
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => {
      // Category filter
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      // Query filter
      if (!q) return true;
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSub = item.subtitle.toLowerCase().includes(q);
      const matchBadge = item.badge?.toLowerCase().includes(q);
      return matchTitle || matchSub || matchBadge;
    });
  }, [allItems, query, selectedCategory]);

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Ensure active element is scrolled into view
  useEffect(() => {
    if (!resultsContainerRef.current) return;
    const activeEl = resultsContainerRef.current.querySelector<HTMLElement>(`[data-search-idx="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length === 0 ? 0 : (prev - 1 + filteredItems.length) % filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) {
        onClose();
        if (item.external) {
          window.open(item.href, "_blank", "noopener,noreferrer");
        } else {
          router.push(item.href);
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search palette"
      className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-16 sm:pt-24 bg-black/60 backdrop-blur-md transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Outer Compound Frame (ReactBits double outline styling) */}
      <div className="w-full max-w-2xl rounded-2xl border border-black/10 bg-neutral-200/50 p-1.5 shadow-2xl transition-all dark:border-[#222] dark:bg-[#121212] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex flex-col rounded-xl border border-black/5 bg-white overflow-hidden dark:border-[#1a1a1a] dark:bg-[#080808]">
          
          {/* Top Search Input Bar */}
          <div className="relative flex items-center border-b border-border/80 px-4 py-3 sm:px-5">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-foreground-faint mr-3"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search AI agents, tools, strategies, docs..."
              className="w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-foreground-faint focus:outline-none"
            />

            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="shrink-0 rounded-md p-1 text-foreground-faint hover:text-foreground hover:bg-surface cursor-pointer transition-colors"
                aria-label="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-foreground-faint">
                ESC
              </kbd>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/50 px-4 py-2 text-xs scrollbar-none bg-surface/30">
            {(
              [
                { key: "all", label: "All" },
                { key: "agents", label: "Agents" },
                { key: "pages", label: "Pages" },
                { key: "strategies", label: "Strategies" },
                { key: "docs", label: "Docs & Specs" },
              ] as const
            ).map(({ key, label }) => {
              const active = selectedCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-foreground-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}

            {loadingAgents && (
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-foreground-faint shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                syncing...
              </span>
            )}
          </div>

          {/* Results List */}
          <div
            ref={resultsContainerRef}
            className="max-h-[380px] overflow-y-auto p-2 divide-y divide-border/20"
          >
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-foreground">No matching results found</p>
                <p className="mt-1 text-xs text-foreground-faint">
                  Try searching for an agent name, trading tool, or contract address.
                </p>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    onClick={() => onClose()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    data-search-idx={idx}
                    className={`group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-all ${
                      isSelected
                        ? "bg-surface-hover text-foreground shadow-2xs"
                        : "text-foreground-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Icon per category */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                          isSelected
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-border bg-surface text-foreground-muted"
                        }`}
                      >
                        {item.category === "agents" ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 8V4H8" />
                            <rect width="16" height="12" x="4" y="8" rx="2" />
                            <path d="M2 14h2" />
                            <path d="M20 14h2" />
                            <path d="M15 13v2" />
                            <path d="M9 13v2" />
                          </svg>
                        ) : item.category === "pages" ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="7" height="7" x="3" y="3" rx="1" />
                            <rect width="7" height="7" x="14" y="3" rx="1" />
                            <rect width="7" height="7" x="14" y="14" rx="1" />
                            <rect width="7" height="7" x="3" y="14" rx="1" />
                          </svg>
                        ) : item.category === "strategies" ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3v18h18" />
                            <path d="m19 9-5 5-4-4-3 3" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                            <path d="M6 6h10" />
                            <path d="M6 10h10" />
                          </svg>
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {item.title}
                          </p>
                          {item.external && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground-faint shrink-0">
                              <path d="M7 17 17 7M7 7h10v10" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-foreground-muted truncate leading-relaxed">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Badge & Enter Glyph */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-medium ${
                            item.badgeType === "accent"
                              ? "bg-accent/10 text-accent border border-accent/20"
                              : item.badgeType === "positive"
                              ? "bg-positive/10 text-positive border border-positive/20"
                              : item.badgeType === "warning"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-surface text-foreground-faint border border-border"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      <span
                        className={`font-mono text-xs text-foreground-faint transition-transform duration-150 ${
                          isSelected ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
                        }`}
                      >
                        ↵
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer Legend */}
          <div className="flex flex-wrap items-center justify-between border-t border-border/60 bg-surface/40 px-4 py-2.5 text-[11px] font-mono text-foreground-faint">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface px-1 text-[9px]">↑</kbd>
                <kbd className="rounded border border-border bg-surface px-1 text-[9px]">↓</kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface px-1 text-[9px]">↵</kbd>
                <span>select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface px-1 text-[9px]">esc</kbd>
                <span>close</span>
              </span>
            </div>

            <span className="hidden sm:inline-block">
              {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
