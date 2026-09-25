"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamicImport from "next/dynamic";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BaseLogo } from "@/components/ui/BaseLogo";
import { SolanaLogo } from "@/components/ui/SolanaLogo";
import { XLayerLogo } from "@/components/ui/XLayerLogo";
import { GlobalSearchModal } from "@/components/site/GlobalSearchModal";
import { ExternalLinkGlyph } from "@/components/ui/StatusGlyphs";
import { ScrolledNavbar } from "@/components/site/ScrolledNavbar";
import { BrandLogoMenu } from "@/components/site/BrandLogoMenu";

const WalletMultiButton = dynamicImport(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false },
);

const BaseConnectButton = dynamicImport(
  () => import("@/components/ui/BaseConnectButton").then((mod) => mod.BaseConnectButton),
  { ssr: false },
);

// Primary nav — always visible on desktop (no dropdown)
const PRIMARY_LINKS: { href: string; label: string; external?: boolean; badge?: string }[] = [
  { href: "/leaderboard", label: "Leaderboard", external: false },
  { href: "/trade", label: "Trade", external: false },
  { href: "/arena", label: "Arena", external: false },
  { href: "/create", label: "Deploy Agent", external: false },
];

// Tools dropdown items
const TOOLS_LINKS = [
  {
    href: "/backtest",
    label: "Backtest Lab",
    description: "Test strategies against historical data",
    external: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-foreground-muted">
        <path d="M2 12V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M1 12h14M5 9l2-2 2 2 2-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/paper",
    label: "Paper Trading",
    description: "Simulate live trading with virtual capital",
    external: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-foreground-muted">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Your agents and portfolio overview",
    external: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-foreground-muted">
        <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
];

// Resources dropdown items
const RESOURCES_LINKS = [
  {
    href: "https://docs.viperx.site",
    label: "Documentation",
    description: "ViperX core protocol & architecture specs",
    external: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-foreground-muted">
        <path d="M3 2h7l4 4v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    href: "https://docs.viperx.site/security/smart-contracts",
    label: "System Specs",
    description: "Deployed contracts & verification guidelines",
    external: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-foreground-muted">
        <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 6h6M5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "https://docs.viperx.site/quickstart",
    label: "User Guides",
    description: "Prerequisites, parameters, and quickstarts",
    external: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-foreground-muted">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8 4.5v4.5M8 11.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

// Mobile: flatten all links for the slide-down menu
const ALL_MOBILE_LINKS = [
  ...PRIMARY_LINKS.map(({ href, label, external }) => ({ href, label, external: !!external })),
  ...TOOLS_LINKS.map(({ href, label, external }) => ({ href, label, external: !!external })),
  ...RESOURCES_LINKS.map(({ href, label, external }) => ({ href, label, external: !!external })),
];

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      className={`shrink-0 text-foreground-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<"solana" | "base" | "xlayer">("base");
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [resourcesDropdownOpen, setResourcesDropdownOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const resourcesDropdownRef = useRef<HTMLDivElement>(null);
  const toolsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resourcesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAgentProfilePage = Boolean(pathname?.startsWith("/agents/"));

  // Track window scroll ONLY on agent profile pages (/agents/[agentPda])
  useEffect(() => {
    if (!isAgentProfilePage) {
      setIsScrolled(false);
      return;
    }

    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      // Trigger when scrolling past the top hero summary of the agent profile page (~200px)
      setIsScrolled(scrollY > 200);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isAgentProfilePage]);

  // Global keyboard shortcut for search modal (⌘K / Ctrl+K / F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput =
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      } else if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToolsEnter = () => {
    if (toolsTimeoutRef.current) clearTimeout(toolsTimeoutRef.current);
    if (resourcesTimeoutRef.current) clearTimeout(resourcesTimeoutRef.current);
    setResourcesDropdownOpen(false);
    setToolsDropdownOpen(true);
  };

  const handleToolsLeave = () => {
    if (toolsTimeoutRef.current) clearTimeout(toolsTimeoutRef.current);
    toolsTimeoutRef.current = setTimeout(() => {
      setToolsDropdownOpen(false);
    }, 220);
  };

  const handleResourcesEnter = () => {
    if (resourcesTimeoutRef.current) clearTimeout(resourcesTimeoutRef.current);
    if (toolsTimeoutRef.current) clearTimeout(toolsTimeoutRef.current);
    setToolsDropdownOpen(false);
    setResourcesDropdownOpen(true);
  };

  const handleResourcesLeave = () => {
    if (resourcesTimeoutRef.current) clearTimeout(resourcesTimeoutRef.current);
    resourcesTimeoutRef.current = setTimeout(() => {
      setResourcesDropdownOpen(false);
    }, 220);
  };

  // Close ALL dropdowns + mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setToolsDropdownOpen(false);
    setResourcesDropdownOpen(false);
    setNetworkDropdownOpen(false);
    if (toolsTimeoutRef.current) clearTimeout(toolsTimeoutRef.current);
    if (resourcesTimeoutRef.current) clearTimeout(resourcesTimeoutRef.current);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (toolsTimeoutRef.current) clearTimeout(toolsTimeoutRef.current);
      if (resourcesTimeoutRef.current) clearTimeout(resourcesTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const updateNetwork = () => {
      const saved = localStorage.getItem("viperx-active-chain");
      if (saved === "solana" || saved === "base" || saved === "xlayer") {
        setSelectedNetwork(saved as "solana" | "base" | "xlayer");
      } else {
        setSelectedNetwork("base");
      }
    };
    updateNetwork();
    window.addEventListener("storage", updateNetwork);
    window.addEventListener("viperx-chain-changed", updateNetwork);
    return () => {
      window.removeEventListener("storage", updateNetwork);
      window.removeEventListener("viperx-chain-changed", updateNetwork);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target as Node)) {
        setNetworkDropdownOpen(false);
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setToolsDropdownOpen(false);
      }
      if (resourcesDropdownRef.current && !resourcesDropdownRef.current.contains(event.target as Node)) {
        setResourcesDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNetworkChange = (network: "solana" | "base" | "xlayer") => {
    setSelectedNetwork(network);
    localStorage.setItem("viperx-active-chain", network);
    window.dispatchEvent(new Event("viperx-chain-changed"));
    window.dispatchEvent(new Event("storage"));
    setNetworkDropdownOpen(false);
  };

  const isToolsActive = TOOLS_LINKS.some((l) => pathname === l.href);
  const isResourcesActive = RESOURCES_LINKS.some((l) => pathname === l.href);

  // Dedicated DEX terminal renders its own single unified full-width workstation bar
  if (pathname === "/trade") {
    return null;
  }

  return (
    <>
      {/* ── Mobile slide-down panel backdrop ──────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 top-16 z-[55] bg-black/20 dark:bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile slide-down panel ─────────────────────────────────────── */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          className="fixed top-16 left-0 right-0 z-[60] md:hidden border-b border-border bg-background/95 backdrop-blur-2xl shadow-2xl"
        >
            {/* Network selector */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex gap-2">
                {(["base", "xlayer", "solana"] as const).map((net) => (
                  <button
                    key={net}
                    type="button"
                    onClick={() => handleNetworkChange(net)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                      selectedNetwork === net
                        ? "border-border-strong bg-surface text-foreground shadow-sm"
                        : "border-border text-foreground-muted hover:bg-surface/50 hover:text-foreground"
                    }`}
                  >
                    {net === "solana" ? (
                      <SolanaLogo className="h-3.5 w-3.5" />
                    ) : net === "xlayer" ? (
                      <XLayerLogo className="h-3.5 w-3.5" />
                    ) : (
                      <BaseLogo className="h-3.5 w-3.5 rounded-xs" />
                    )}
                    {net === "solana" ? "Solana" : net === "xlayer" ? "X Layer" : "Base"}
                  </button>
                ))}
              </div>
            </div>

          {/* Nav links */}
          <nav className="p-3">
            <ul className="flex flex-col gap-1">
              {ALL_MOBILE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-xl px-5 py-3.5 text-base font-semibold transition-all ${
                      pathname === link.href
                        ? "bg-surface text-foreground font-bold shadow-sm"
                        : "text-foreground-muted hover:bg-surface/50 hover:text-foreground"
                    }`}
                    style={{ touchAction: "manipulation" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Mobile Menu Footer */}
          <div className="border-t border-border px-5 py-4 bg-background-elevated/40 flex flex-col gap-3">
            {/* Socials / Github / Home */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono text-foreground-faint">
                <Link href="/" onClick={() => setMobileOpen(false)} className="hover:text-foreground">
                  Home
                </Link>
                <a
                  href="https://docs.viperx.site"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="hover:text-foreground"
                >
                  Docs
                </a>
                <a
                  href="https://docs.viperx.site/security/smart-contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="hover:text-foreground"
                >
                  Specs
                </a>
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-foreground-faint pt-1 border-t border-border/10">
                <a
                  href="https://x.com/ViperX_site"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  X
                </a>
                <a
                  href="https://github.com/ritesh59697/ViperX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  GitHub
                </a>
              </div>
            </div>

            {/* Contract badges */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between font-mono text-[10px] text-foreground-faint">
                <span>BASE REGISTRY</span>
                <a
                  href="https://sepolia.basescan.org/address/0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground break-all"
                >
                  0xA25...C7ee
                </a>
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-foreground-faint">
                <span>X LAYER VAULT</span>
                <a
                  href="https://www.oklink.com/xlayer-test/address/0x9Dcfe752AC97F167763FeD87f4100F33cD29dbb7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground break-all"
                >
                  0x9Dc...dbb7
                </a>
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-foreground-faint">
                <span>SOL PROGRAM</span>
                <a
                  href="https://explorer.solana.com/address/321hJbttyyeZ8pzisiKB93a5XdopV2N6n2gtvwrdQVRm?cluster=devnet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground break-all"
                >
                  321hJ...QVRm
                </a>
              </div>
            </div>

            {/* Copyright */}
            <div className="text-[10px] text-center font-mono text-foreground-faint/60 mt-1">
              © {new Date().getFullYear()} ViperX Protocol
            </div>
          </div>
        </div>
      )}

      <header
        className={`sticky top-0 z-[65] w-full border-b border-border bg-background/85 backdrop-blur-xl transition-all duration-300 ease-in-out ${
          isAgentProfilePage && isScrolled
            ? "-translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100 pointer-events-auto"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-[76rem] items-center gap-6 px-6">

          <BrandLogoMenu onAction={() => setMobileOpen(false)} />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-2 md:flex">
              {PRIMARY_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className={`px-2 py-1 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? "text-foreground"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.badge && (
                      <span className="rounded bg-positive/10 border border-positive/30 px-1.5 py-0.2 text-[9px] font-mono text-positive uppercase leading-tight font-semibold tracking-wider">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* Tools dropdown with seamless hover bridge & click-toggle */}
              <div
                className="relative"
                ref={toolsDropdownRef}
                onMouseEnter={handleToolsEnter}
                onMouseLeave={handleToolsLeave}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (toolsTimeoutRef.current) clearTimeout(toolsTimeoutRef.current);
                    setToolsDropdownOpen((v) => !v);
                    setResourcesDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors cursor-pointer ${
                    isToolsActive || toolsDropdownOpen
                      ? "text-foreground"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  Tools
                  <ChevronDown open={toolsDropdownOpen} />
                </button>

                {/* Dropdown Container with invisible hover bridge padding (pt-2 instead of empty mt-1.5) */}
                <div
                  className={`absolute left-0 top-full pt-2 w-72 z-[70] transition-all duration-200 ease-out origin-top-left ${
                    toolsDropdownOpen
                      ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                  }`}
                >
                  <div className="rounded-xl border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
                    {TOOLS_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        onClick={() => setToolsDropdownOpen(false)}
                        className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface ${
                          pathname === link.href ? "bg-surface" : ""
                        }`}
                      >
                        <div className="mt-0.5">{link.icon}</div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {link.label}
                          </p>
                          <p className="mt-0.5 text-xs text-foreground-muted leading-tight">{link.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resources dropdown with seamless hover bridge & click-toggle */}
              <div
                className="relative"
                ref={resourcesDropdownRef}
                onMouseEnter={handleResourcesEnter}
                onMouseLeave={handleResourcesLeave}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (resourcesTimeoutRef.current) clearTimeout(resourcesTimeoutRef.current);
                    setResourcesDropdownOpen((v) => !v);
                    setToolsDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors cursor-pointer ${
                    isResourcesActive || resourcesDropdownOpen
                      ? "text-foreground"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  Resources
                  <ChevronDown open={resourcesDropdownOpen} />
                </button>

                {/* Dropdown Container with invisible hover bridge padding (pt-2 instead of empty mt-1.5) */}
                <div
                  className={`absolute left-0 top-full pt-2 w-72 z-[70] transition-all duration-200 ease-out origin-top-left ${
                    resourcesDropdownOpen
                      ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                  }`}
                >
                  <div className="rounded-xl border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
                    {RESOURCES_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        onClick={() => setResourcesDropdownOpen(false)}
                        className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface ${
                          pathname === link.href ? "bg-surface" : ""
                        }`}
                      >
                        <div className="mt-0.5">{link.icon}</div>
                        <div>
                          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <span>{link.label}</span>
                            {link.external && (
                              <ExternalLinkGlyph className="h-3 w-3 text-foreground-faint transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-foreground-muted leading-tight">{link.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </nav>

          {/* ── Right: network status + controls ──────────────────────────── */}
          <div className="ml-auto flex shrink-0 items-center gap-2.5">

            {/* Search Trigger Button */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="group hidden sm:flex items-center gap-2.5 rounded-full border border-border/80 dark:border-white/12 bg-background-elevated dark:bg-white/[0.04] px-3.5 py-1.5 text-xs text-foreground-muted hover:border-border-strong dark:hover:border-white/25 hover:text-foreground hover:bg-surface-hover dark:hover:bg-white/[0.07] transition-all duration-200 cursor-pointer shadow-2xs select-none"
              title="Search (⌘K or F)"
              aria-label="Open search dialog"
            >
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-foreground-faint group-hover:text-foreground transition-colors"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span className="font-sans text-xs font-medium text-foreground-muted group-hover:text-foreground transition-colors">Find...</span>
              <kbd className="inline-flex items-center rounded border border-border/80 dark:border-white/10 bg-background dark:bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-foreground-faint group-hover:text-foreground-muted transition-colors">
                ⌘K
              </kbd>
            </button>

            {/* Mobile Search Icon Button */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              aria-label="Open search"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background-elevated text-foreground-muted hover:text-foreground transition-colors sm:hidden"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            <ThemeToggle />

            {/* Desktop: network picker */}
            <div className="relative hidden md:block" ref={networkDropdownRef}>
              <button
                type="button"
                onClick={() => setNetworkDropdownOpen((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background-elevated px-3 text-xs font-semibold text-foreground transition-colors hover:border-border-strong cursor-pointer"
              >
                {selectedNetwork === "solana" ? (
                  <>
                    <SolanaLogo />
                    <span>Solana</span>
                  </>
                ) : selectedNetwork === "xlayer" ? (
                  <>
                    <XLayerLogo />
                    <span>X Layer</span>
                  </>
                ) : (
                  <>
                    <BaseLogo />
                    <span>Base</span>
                  </>
                )}
                <ChevronDown open={networkDropdownOpen} />
              </button>
              {networkDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-36 rounded-xl border border-border bg-background/95 p-1 shadow-xl backdrop-blur-xl z-50">
                  <button
                    type="button"
                    onClick={() => handleNetworkChange("base")}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface cursor-pointer"
                  >
                    <BaseLogo />
                    <span>Base</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNetworkChange("xlayer")}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface cursor-pointer"
                  >
                    <XLayerLogo />
                    <span>X Layer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNetworkChange("solana")}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface cursor-pointer"
                  >
                    <SolanaLogo />
                    <span>Solana</span>
                  </button>
                </div>
              )}
            </div>

            {/* Connect Wallet Button — always visible in navbar on both mobile & desktop */}
            <div className="flex items-center">
              {selectedNetwork === "solana" ? <WalletMultiButton /> : <BaseConnectButton />}
            </div>

            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              className="relative flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[4px] rounded-full border border-border text-foreground transition-colors hover:bg-surface md:hidden cursor-pointer"
            >
              <span className={`block h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-out ${mobileOpen ? "translate-y-[5.5px] rotate-45" : ""}`} />
              <span className={`block h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-out ${mobileOpen ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0"}`} />
              <span className={`block h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-out ${mobileOpen ? "-translate-y-[5.5px] -rotate-45" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Scrolled Secondary Navbar (Agent Profile Pages Only) ─────────── */}
      {isAgentProfilePage && (
        <ScrolledNavbar
          isVisible={isScrolled}
          onOpenSearch={() => setSearchModalOpen(true)}
          selectedNetwork={selectedNetwork}
          onNetworkChange={handleNetworkChange}
        />
      )}

      {/* ── Global Search Modal ─────────────────────────────────────────── */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </>
  );
}
