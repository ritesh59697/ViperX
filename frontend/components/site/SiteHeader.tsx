"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamicImport from "next/dynamic";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BaseLogo } from "@/components/ui/BaseLogo";
import { SolanaLogo } from "@/components/ui/SolanaLogo";

const WalletMultiButton = dynamicImport(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false },
);

const BaseConnectButton = dynamicImport(
  () => import("@/components/ui/BaseConnectButton").then((mod) => mod.BaseConnectButton),
  { ssr: false },
);

// Primary nav — always visible on desktop (no dropdown)
const PRIMARY_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/arena", label: "Arena" },
  { href: "/create", label: "Deploy Agent" },
];

// Tools dropdown items
const TOOLS_LINKS = [
  {
    href: "/backtest",
    label: "Backtest Lab",
    description: "Test strategies against historical data",
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
    href: "/docs",
    label: "Documentation",
    description: "ViperX core protocol & architecture specs",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-foreground-muted">
        <path d="M3 2h7l4 4v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    href: "/specs",
    label: "System Specs",
    description: "Deployed contracts & audit guidelines",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-foreground-muted">
        <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 6h6M5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/guides",
    label: "User Guides",
    description: "Prerequisites, parameters, and quickstarts",
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
  ...PRIMARY_LINKS,
  ...TOOLS_LINKS.map(({ href, label }) => ({ href, label })),
  ...RESOURCES_LINKS.map(({ href, label }) => ({ href, label })),
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<"solana" | "base" | "all">("base");
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [resourcesDropdownOpen, setResourcesDropdownOpen] = useState(false);

  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const resourcesDropdownRef = useRef<HTMLDivElement>(null);
  const toolsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resourcesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (saved === "solana" || saved === "base" || saved === "all") {
        setSelectedNetwork(saved as "solana" | "base" | "all");
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

  const handleNetworkChange = (network: "solana" | "base" | "all") => {
    setSelectedNetwork(network);
    localStorage.setItem("viperx-active-chain", network);
    window.dispatchEvent(new Event("viperx-chain-changed"));
    window.dispatchEvent(new Event("storage"));
    setNetworkDropdownOpen(false);
  };

  const isToolsActive = TOOLS_LINKS.some((l) => pathname === l.href);
  const isResourcesActive = RESOURCES_LINKS.some((l) => pathname === l.href);

  const ChevronDown = ({ open }: { open: boolean }) => (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      className={`shrink-0 text-foreground-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

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
                {(["base", "solana", "all"] as const).map((net) => (
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
                    ) : net === "base" ? (
                      <BaseLogo className="h-3.5 w-3.5 rounded-xs" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground shrink-0">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                        <path d="M2 12h20" />
                      </svg>
                    )}
                    {net === "solana" ? "Solana" : net === "base" ? "Base" : "All"}
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

          {/* Network status */}
          <div className="border-t border-border px-5 py-3 flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${selectedNetwork === "solana" ? "bg-[#9945FF] shadow-[0_0_8px_#9945ff]" : "bg-[#0052FF] shadow-[0_0_8px_#0052ff]"}`} />
            <span className="font-mono text-xs text-foreground-faint">
              {selectedNetwork === "solana" ? "solana devnet" : "base sepolia"} · live
            </span>
          </div>

          {/* Mobile Menu Footer */}
          <div className="border-t border-border px-5 py-4 bg-background-elevated/40 flex flex-col gap-3">
            {/* Socials / Github / Home */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono text-foreground-faint">
                <Link href="/" onClick={() => setMobileOpen(false)} className="hover:text-foreground">
                  Home
                </Link>
                <Link href="/docs" onClick={() => setMobileOpen(false)} className="hover:text-foreground">
                  Docs
                </Link>
                <Link href="/specs" onClick={() => setMobileOpen(false)} className="hover:text-foreground">
                  Specs
                </Link>
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-foreground-faint pt-1 border-t border-border/10">
                <a
                  href="https://x.com/ritesh5969"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  Twitter
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

      <header className="sticky top-0 z-[65] w-full border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[76rem] items-center gap-6 px-6">

          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            style={{ touchAction: "manipulation" }}
            className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-70"
          >
            <img src="/viperx-logo-option-1-exact-logo.png" alt="ViperX Logo" className="h-8 w-8 object-contain" />
            <span className="text-lg font-semibold tracking-tight text-foreground">ViperX</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-2 md:flex">
              {PRIMARY_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-2 py-1 text-sm font-medium transition-colors ${
                      isActive
                        ? "text-foreground"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {link.label}
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
                  <div className="rounded-xl border border-border bg-background-elevated/98 p-2 shadow-2xl backdrop-blur-2xl">
                    {TOOLS_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
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
                  <div className="rounded-xl border border-border bg-background-elevated/98 p-2 shadow-2xl backdrop-blur-2xl">
                    {RESOURCES_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setResourcesDropdownOpen(false)}
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
            </nav>

          {/* ── Right: network status + controls ──────────────────────────── */}
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            {/* Network pulse — desktop only */}
            <span className="hidden items-center gap-1.5 font-mono text-xs text-foreground-faint lg:inline-flex">
              <span className={`h-1.5 w-1.5 rounded-full ${
                selectedNetwork === "solana" ? "bg-[#9945FF]" : selectedNetwork === "base" ? "bg-[#0052FF]" : "bg-foreground"
              }`} />
              {selectedNetwork === "solana" ? "solana devnet" : selectedNetwork === "base" ? "base sepolia" : "multi-chain"}
            </span>

            <ThemeToggle />

            {/* Desktop: network picker */}
            <div className="relative hidden md:block" ref={networkDropdownRef}>
              <button
                type="button"
                onClick={() => setNetworkDropdownOpen((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background-elevated px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-border-strong cursor-pointer shadow-xs"
              >
                {selectedNetwork === "solana" ? (
                  <>
                    <SolanaLogo className="h-4 w-4 shrink-0" />
                    <span>Solana</span>
                  </>
                ) : selectedNetwork === "base" ? (
                  <>
                    <BaseLogo className="h-4 w-4 shrink-0 rounded-xs" />
                    <span>Base</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                      <path d="M2 12h20" />
                    </svg>
                    <span>All Networks</span>
                  </>
                )}
                <ChevronDown open={networkDropdownOpen} />
              </button>
              {networkDropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-border-strong bg-background-elevated p-1.5 shadow-2xl backdrop-blur-2xl z-50 divide-y divide-border/40">
                  <div className="py-0.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleNetworkChange("base")}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors hover:bg-surface-hover cursor-pointer ${
                        selectedNetwork === "base" ? "text-foreground bg-surface" : "text-foreground-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <BaseLogo className="h-4 w-4 shrink-0 rounded-xs" />
                        <span>Base</span>
                      </span>
                      {selectedNetwork === "base" && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNetworkChange("solana")}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors hover:bg-surface-hover cursor-pointer ${
                        selectedNetwork === "solana" ? "text-foreground bg-surface" : "text-foreground-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <SolanaLogo className="h-4 w-4 shrink-0" />
                        <span>Solana</span>
                      </span>
                      {selectedNetwork === "solana" && <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNetworkChange("all")}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors hover:bg-surface-hover cursor-pointer ${
                        selectedNetwork === "all" ? "text-foreground bg-surface" : "text-foreground-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground shrink-0">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                          <path d="M2 12h20" />
                        </svg>
                        <span>All Networks</span>
                      </span>
                      {selectedNetwork === "all" && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                    </button>
                  </div>
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface md:hidden"
            >
              {mobileOpen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
                  <path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
