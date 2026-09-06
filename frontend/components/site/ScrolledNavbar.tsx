"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ExternalLinkGlyph } from "@/components/ui/StatusGlyphs";

export interface AgentContextData {
  name: string;
  agentPda: string;
  isPaper?: boolean;
  status?: string;
  hasTrades?: boolean;
}

interface ScrolledNavbarProps {
  isVisible: boolean;
  onOpenSearch: () => void;
  selectedNetwork: "solana" | "base";
  onNetworkChange: (network: "solana" | "base") => void;
}

// Clean vertical directory items
const MENU_ITEMS = [
  { href: "/arena", label: "Arena", desc: "Competitive trading league & prize bracket", badge: "Season 1" },
  { href: "/leaderboard", label: "Leaderboard", desc: "Audited on-chain PnL, Sharpe & fills", badge: "Verified PnL" },
  { href: "/create", label: "Deploy Agent", desc: "Non-custodial algorithmic agent runtime", badge: "Launch" },
  { href: "/backtest", label: "Backtest Lab", desc: "Historical tick data strategy simulation" },
  { href: "/paper", label: "Paper Trading", desc: "Virtual execution with live Binance feeds" },
  { href: "/trade", label: "Trading Terminal", desc: "Real-time order book & manual execution" },
  { href: "/dashboard", label: "Dashboard", desc: "Your deployed agents & capital allocation" },
];

// Quick jump tabs for Agent Profile Page
const AGENT_PAGE_TABS = [
  { id: "agent-overview", label: "Overview" },
  { id: "agent-chart", label: "Chart" },
  { id: "agent-history", label: "History" },
  { id: "agent-snapshots", label: "Snapshots" },
  { id: "agent-copy", label: "Copy Trading" },
  { id: "agent-skills", label: "Skills" },
  { id: "agent-tuning", label: "Tuning" },
];

export function ScrolledNavbar({
  isVisible,
  onOpenSearch,
}: ScrolledNavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("agent-overview");
  const [agentData, setAgentData] = useState<AgentContextData | null>(null);

  const isAgentPage = pathname.startsWith("/agents/");

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close menu whenever navbar visibility changes (e.g. user scrolled upside to top)
  useEffect(() => {
    if (!isVisible) {
      setMenuOpen(false);
    }
  }, [isVisible]);

  // Auto-close menu if user scrolls the page upside or downside while menu is open
  useEffect(() => {
    if (!menuOpen) return;

    const initialScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Close menu if page scrolls by more than 25px
      if (Math.abs(currentScrollY - initialScrollY) > 25) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [menuOpen]);

  // Listen for agent profile events emitted by AgentNavSync
  useEffect(() => {
    const handleAgentSync = (e: Event) => {
      const customEvent = e as CustomEvent<AgentContextData>;
      if (customEvent.detail) {
        setAgentData(customEvent.detail);
      }
    };

    window.addEventListener("viperx-agent-profile-mounted", handleAgentSync);
    return () => {
      window.removeEventListener("viperx-agent-profile-mounted", handleAgentSync);
    };
  }, []);

  const isScrollingLockRef = useRef(false);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    };
  }, []);

  // Track active section for agent profile page tabs without scroll-spy jitter
  useEffect(() => {
    if (!isAgentPage) return;

    const handleScrollSpy = () => {
      if (isScrollingLockRef.current) return;

      const sections = AGENT_PAGE_TABS.map((tab) => ({
        id: tab.id,
        el: document.getElementById(tab.id),
      })).filter((item): item is { id: string; el: HTMLElement } => item.el !== null);

      if (sections.length === 0) return;

      let currentId = sections[0].id;
      for (const section of sections) {
        const rect = section.el.getBoundingClientRect();
        if (rect.top <= 140) {
          currentId = section.id;
        }
      }

      setActiveSection((prev) => (prev !== currentId ? currentId : prev));
    };

    window.addEventListener("scroll", handleScrollSpy, { passive: true });
    handleScrollSpy();
    return () => window.removeEventListener("scroll", handleScrollSpy);
  }, [isAgentPage, pathname]);

  // Smooth scroll helper with lock to prevent scroll-spy jitter while moving
  const scrollToAnchor = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;

    // Lock scroll spy immediately so the pill glides to the clicked tab without intermediate flicker
    setActiveSection(id);
    isScrollingLockRef.current = true;
    if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);

    const offset = 88;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });

    // Release lock once the smooth scroll has completed
    lockTimeoutRef.current = setTimeout(() => {
      isScrollingLockRef.current = false;
    }, 750);
  };

  if (!isAgentPage) {
    return null;
  }

  return (
    <>
      {/* ── Normal Theme Floating Island Navbar (Clean Single Card) ──────── */}
      <div
        className={`fixed top-3 sm:top-4 left-0 right-0 z-[70] px-4 sm:px-6 transition-all duration-300 ease-out ${
          isVisible
            ? "translate-y-0 opacity-100 scale-100 pointer-events-auto visible"
            : "-translate-y-8 opacity-0 scale-[0.98] pointer-events-none invisible"
        }`}
      >
        <div className={`mx-auto max-w-[76rem] ${isVisible ? "pointer-events-auto" : "pointer-events-none"}`}>
          {/* Single Clean Card matching the site's exact theme tokens with high-contrast dark mode */}
          <div
            className="flex h-14 sm:h-15 w-full items-center justify-between gap-3 rounded-2xl border border-border dark:border-white/20 bg-background/95 dark:bg-[#121316]/98 px-4 sm:px-5 shadow-xl dark:shadow-[0_16px_40px_rgba(0,0,0,0.85)] dark:ring-1 dark:ring-white/10 backdrop-blur-2xl transition-all duration-200"
          >
            {/* Left: Sidebar Toggle + Context */}
            <div className="flex items-center gap-3 shrink-0">
              <motion.button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                whileTap={{ scale: 0.94 }}
                className={`flex items-center justify-center rounded-xl border p-2.5 transition-colors cursor-pointer select-none shadow-2xs ${
                  menuOpen
                    ? "border-accent/40 bg-accent/10 dark:bg-accent/20 text-accent"
                    : "border-border/80 dark:border-white/15 bg-surface dark:bg-white/[0.06] text-foreground hover:border-border-strong dark:hover:border-white/30 hover:bg-surface-hover dark:hover:bg-white/[0.1]"
                }`}
                aria-expanded={menuOpen}
                aria-controls="sidebar-menu"
                title="Open Navigation"
              >
                {/* Sidebar Panel Icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </motion.button>

              <span className="h-5 w-px bg-border dark:bg-white/15 hidden sm:inline-block" />

              {/* Clean Context Typography */}
              {isAgentPage ? (
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-[220px]">
                    {agentData?.name || "Agent Profile"}
                  </span>
                  {agentData?.isPaper && (
                    <span className="rounded border border-amber-500/30 dark:border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-500 uppercase">
                      Paper
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="font-semibold text-foreground tracking-wider uppercase text-[11px]">
                    Protocol Live
                  </span>
                  <span className="hidden sm:inline-block rounded border border-border/80 dark:border-white/15 bg-surface dark:bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-bold text-foreground-faint uppercase">
                    Base Sepolia
                  </span>
                </div>
              )}
            </div>

            {/* Center: Agent Jump Tabs (Desktop / Large Screens) */}
            <div className="hidden lg:flex flex-1 items-center justify-center min-w-0 px-2">
              {isAgentPage && (
                <nav
                  aria-label="Agent Sections"
                  className="flex items-center gap-1 rounded-xl border border-border/80 dark:border-white/15 bg-surface dark:bg-white/[0.04] p-1 overflow-x-auto scrollbar-none max-w-full shadow-2xs"
                >
                  {AGENT_PAGE_TABS.map((tab) => {
                    const isActive = activeSection === tab.id;
                    return (
                      <motion.button
                        key={tab.id}
                        type="button"
                        onClick={() => scrollToAnchor(tab.id)}
                        whileTap={{ scale: 0.94 }}
                        className={`relative rounded-lg px-3 sm:px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer select-none ${
                          isActive
                            ? "text-foreground dark:text-white font-semibold"
                            : "text-foreground-muted hover:text-foreground hover:bg-surface-hover dark:hover:bg-white/[0.06]"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeAgentTabPill"
                            className="absolute inset-0 rounded-lg bg-background dark:bg-white/15 shadow-xs dark:shadow-sm border border-border/60 dark:border-white/10"
                            transition={{
                              type: "spring",
                              stiffness: 450,
                              damping: 35,
                              mass: 0.8,
                            }}
                          />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                      </motion.button>
                    );
                  })}
                </nav>
              )}
            </div>

            {/* Right: Search + ThemeToggle + Horizontally Expanded Deploy CTA */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Search Trigger */}
              <button
                type="button"
                onClick={onOpenSearch}
                aria-label="Search"
                className="flex items-center gap-2 rounded-xl border border-border/80 dark:border-white/15 bg-surface dark:bg-white/[0.05] px-3.5 py-2 text-xs text-foreground-muted hover:border-border-strong dark:hover:border-white/30 hover:bg-surface-hover dark:hover:bg-white/[0.09] hover:text-foreground transition-all cursor-pointer shadow-2xs"
                title="Search (⌘K)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span className="hidden xl:inline text-xs font-medium">Search</span>
                <kbd className="hidden sm:inline-block rounded border border-border/80 dark:border-white/15 bg-background dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-foreground-faint">
                  ⌘K
                </kbd>
              </button>

              {/* Theme Toggle */}
              <div className="flex items-center">
                <ThemeToggle />
              </div>

              {/* Horizontally Expanded Deploy CTA Button (Desktop only, mobile has it in menu) */}
              <Link
                href="/create"
                className="hidden md:inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-6 sm:px-7 py-2.5 text-xs font-bold tracking-wider uppercase text-white shadow-sm hover:bg-accent-fill hover:opacity-95 active:scale-[0.98] transition-all select-none"
              >
                <span>Deploy Agent</span>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide-out Sidebar Drawer ────────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Dim Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed inset-0 z-[75] bg-black/45 backdrop-blur-[2px]"
              onClick={() => setMenuOpen(false)}
            />

            {/* Sidebar Container */}
            <motion.div
              id="sidebar-menu"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ 
                x: "-100%",
                transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } 
              }}
              transition={{
                type: "spring",
                damping: 28,
                stiffness: 250,
                mass: 0.8
              }}
              className="fixed top-0 left-0 bottom-0 z-[80] w-72 max-w-[85vw] flex flex-col border-r border-border dark:border-white/10 bg-background dark:bg-[#0c0d10] shadow-2xl overflow-hidden"
            >
              {/* Sidebar Header */}
              <div className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-border/60 dark:border-white/10">
                <div className="flex items-center gap-2 select-none">
                  <img src="/viperx-logo-light.png" alt="ViperX" className="h-6 w-6 dark:hidden" />
                  <img src="/viperx-logo-option-1-exact-logo.png" alt="ViperX" className="h-6 w-6 hidden dark:block" />
                  <span className="font-sans text-lg font-bold tracking-tight leading-none pt-0.5">
                    <span className="text-foreground">Viper</span>
                    <span className="text-accent">X</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-surface dark:bg-white/[0.05] border border-border dark:border-white/10 text-foreground-muted hover:text-foreground hover:bg-surface-hover dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto scrollbar-none py-4 px-3 flex flex-col gap-6">
                
                {/* Mobile-only Quick Jump Tabs */}
                {isAgentPage && (
                  <div className="lg:hidden flex flex-col gap-1">
                    <div className="px-3 mb-1 text-[10px] font-mono font-bold tracking-wider text-foreground-faint uppercase">
                      Agent Profile
                    </div>
                    {AGENT_PAGE_TABS.map((tab) => {
                      const isActive = activeSection === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            scrollToAnchor(tab.id);
                            setMenuOpen(false);
                          }}
                          className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${
                            isActive
                              ? "bg-accent/10 dark:bg-accent/20 text-accent font-semibold"
                              : "text-foreground-muted hover:bg-surface dark:hover:bg-white/[0.04] hover:text-foreground"
                          }`}
                        >
                          <span className="text-sm font-medium">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Primary Navigation */}
                <div className="flex flex-col gap-1">
                  <div className="px-3 mb-1 text-[10px] font-mono font-bold tracking-wider text-foreground-faint uppercase">
                    Navigation
                  </div>
                  {MENU_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="group flex flex-col gap-0.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface dark:hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className="rounded-full bg-accent/10 dark:bg-accent/20 px-2 py-0.5 font-mono text-[9px] font-bold text-accent border border-accent/20 dark:border-accent/30">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.desc && (
                        <span className="text-xs text-foreground-muted leading-tight">
                          {item.desc}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Sidebar Footer */}
              <div className="shrink-0 border-t border-border/60 dark:border-white/10 bg-surface/30 dark:bg-white/[0.01] p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-3 font-mono text-xs">
                  <a
                    href="https://docs.viperx.site"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-foreground-muted hover:text-foreground transition-colors group"
                  >
                    <span>Documentation</span>
                    <ExternalLinkGlyph className="h-3 w-3 group-hover:text-foreground transition-colors" />
                  </a>
                  <a
                    href="https://docs.viperx.site/security/smart-contracts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-foreground-muted hover:text-foreground transition-colors group"
                  >
                    <span>Smart Contracts</span>
                    <ExternalLinkGlyph className="h-3 w-3 group-hover:text-foreground transition-colors" />
                  </a>
                  <a
                    href="https://x.com/ViperX_site"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-foreground-muted hover:text-foreground transition-colors group"
                  >
                    <span>X / Twitter</span>
                    <ExternalLinkGlyph className="h-3 w-3 group-hover:text-foreground transition-colors" />
                  </a>
                  <a
                    href="https://github.com/ritesh59697/ViperX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-foreground-muted hover:text-foreground transition-colors group"
                  >
                    <span>GitHub</span>
                    <ExternalLinkGlyph className="h-3 w-3 group-hover:text-foreground transition-colors" />
                  </a>
                </div>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
