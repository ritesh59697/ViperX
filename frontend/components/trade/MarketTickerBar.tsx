"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  PerpMarket,
  SUPPORTED_MARKETS,
  useTradeStore,
} from "@/lib/trade/tradeStore";
import { formatPrice, formatSignedPercent, formatUsd } from "@/lib/trade/math";
import { RuneIcon } from "@/components/ui/RuneIcon";
import { cn } from "@/lib/utils";

interface MarketTickerBarProps {
  stats: {
    markPrice: number;
    indexPrice?: number;
    high24h?: number;
    low24h?: number;
    change24h?: number;
    price24hChange?: number;
    volume24hUsd?: number;
    volume24h?: number;
    fundingRateHourly?: number;
    fundingRate?: number;
    nextFundingCountdown?: string;
    openInterestUsd?: number;
  };
  pythLatencyMs?: number;
}

export function MarketTokenIcon({
  symbol,
  className = "h-4 w-4 shrink-0",
}: {
  symbol: string;
  className?: string;
}) {
  if (symbol.includes("OKB")) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className={cn("shrink-0 text-foreground", className)}
      >
        <title>okb</title>
        <path
          fill="currentColor"
          d="M3 3h6v6H3zm12 6H9v6H3v6h6v-6h6v6h6v-6h-6zm0 0V3h6v6z"
        />
      </svg>
    );
  }

  let src = "/tokens/eth.svg";
  if (symbol.includes("BTC")) src = "/tokens/btc.svg";
  else if (symbol.includes("SOL")) src = "/tokens/sol.svg";
  else if (symbol.includes("USDC")) src = "/tokens/usdc.svg";
  else if (symbol.includes("NVDA")) src = "/tokens/nvda.svg";
  else if (symbol.includes("TSLA")) src = "/tokens/tsla.svg";
  else if (symbol.includes("AAPL")) src = "/tokens/aapl.svg";
  else if (symbol.includes("COIN")) src = "/tokens/coin.svg";
  else if (symbol.includes("SPY")) src = "/tokens/spy.svg";

  return (
    <img
      src={src}
      alt={symbol}
      className={cn("rounded-full object-contain shrink-0", className)}
    />
  );
}


function Sparkline({ isPositive }: { isPositive: boolean }) {
  return (
    <svg
      className="w-14 h-5 stroke-[1.5] fill-none shrink-0"
      viewBox="0 0 56 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      {isPositive ? (
        <path
          d="M2 16 L12 13 L22 15 L32 8 L42 10 L54 3"
          stroke="#0ecb81"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M2 4 L12 7 L22 5 L32 12 L42 10 L54 17"
          stroke="#f6465d"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

type MarketCategoryTab = "Featured" | "All" | "Favorites" | "Crypto" | "RWA" | "Perps";

type MarketWithMetrics = PerpMarket & {
  displayPrice: number;
  displayChange: number;
  isPositive: boolean;
};

function MarketCardItem({
  market,
  isSelected,
  isFav,
  onSelect,
  onToggleFav,
}: {
  market: MarketWithMetrics;
  isSelected: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex flex-col p-2.5 rounded-xl border transition-all cursor-pointer group select-none",
        isSelected
          ? "bg-accent/10 border-accent/40 shadow-xs"
          : "bg-surface/50 dark:bg-white/[0.03] border-border/60 dark:border-white/[0.06] hover:bg-surface-hover dark:hover:bg-white/[0.07] hover:border-border-strong dark:hover:border-white/15"
      )}
    >
      {/* Top Row: Icon + Ticker + Full Name + Category Badge + Star */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <MarketTokenIcon symbol={market.symbol} className="h-6 w-6 shrink-0" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-foreground tracking-tight truncate">
                {market.symbol.replace("-PERP", "")}
              </span>
              {market.category === "equity" ? (
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1 py-0.2 text-[8px] font-mono font-bold shrink-0">
                  RWA
                </span>
              ) : (
                <span className="rounded bg-[#eaedf2] dark:bg-white/[0.06] px-1.5 py-0.2 text-[9px] font-mono font-medium text-foreground-muted shrink-0">
                  {market.maxLeverage}x
                </span>
              )}
            </div>
            <span className="text-[10px] text-foreground-muted truncate leading-tight">
              {market.name.replace(" (RWA)", "")}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleFav}
          className="text-foreground-muted hover:text-amber-500 cursor-pointer p-1 shrink-0 transition-colors"
          title={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <RuneIcon
            name="tools-star"
            styleVariant={isFav ? "fill" : "normal"}
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              isFav ? "text-amber-400 fill-amber-400" : "text-foreground-faint hover:text-foreground"
            )}
          />
        </button>
      </div>

      {/* Bottom Row: Price + 24h Change Pill + Sparkline */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 dark:border-white/[0.04]">
        <span className="text-xs font-mono font-bold text-foreground">
          {formatPrice(market.displayPrice)}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "text-[10px] font-mono font-semibold px-1 py-0.2 rounded",
              market.isPositive
                ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-500 dark:text-rose-400"
            )}
          >
            {market.isPositive ? "+" : ""}
            {market.displayChange.toFixed(2)}%
          </span>
          <Sparkline isPositive={market.isPositive} />
        </div>
      </div>
    </div>
  );
}

export function MarketTickerBar({ stats, pythLatencyMs = 380 }: MarketTickerBarProps) {
  const { selectedMarket, setSelectedMarket } = useTradeStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<MarketCategoryTab>("Featured");
  const [favorites, setFavorites] = useState<string[]>(["ETH-PERP", "NVDA-PERP"]);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef(stats.markPrice);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [modalPos, setModalPos] = useState({ top: 112, left: 16 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute position relative to viewport so modal is NEVER clipped by card overflow-hidden
  useEffect(() => {
    if (dropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const modalWidth = Math.min(840, window.innerWidth - 24);
      const maxLeft = Math.max(12, window.innerWidth - modalWidth - 12);
      const left = Math.max(12, Math.min(rect.left, maxLeft));
      setModalPos({
        top: rect.bottom + 8,
        left,
      });
    }
  }, [dropdownOpen]);

  const priceChange = stats.change24h ?? stats.price24hChange ?? 1.45;
  const volume = stats.volume24hUsd ?? stats.volume24h ?? 249180;
  const funding = stats.fundingRateHourly ?? stats.fundingRate ?? 0.0012;
  const high = stats.high24h ?? stats.markPrice * 1.03;
  const low = stats.low24h ?? stats.markPrice * 0.97;
  const index = stats.indexPrice ?? stats.markPrice + 1.36;
  const openInterest = stats.openInterestUsd ?? 778990;
  const countdown = stats.nextFundingCountdown ?? "59:32";

  useEffect(() => {
    if (stats.markPrice > prevPriceRef.current) {
      setPriceFlash("up");
    } else if (stats.markPrice < prevPriceRef.current) {
      setPriceFlash("down");
    }
    prevPriceRef.current = stats.markPrice;

    const timer = setTimeout(() => setPriceFlash(null), 800);
    return () => clearTimeout(timer);
  }, [stats.markPrice]);

  // Focus search input when modal opens
  useEffect(() => {
    if (dropdownOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
      setActiveTab("Featured");
    }
  }, [dropdownOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isPositive = priceChange >= 0;

  const toggleFavorite = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  // Filtered markets
  const filteredMarkets = useMemo(() => {
    return SUPPORTED_MARKETS.filter((m) => {
      const matchesSearch =
        m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (activeTab === "Favorites") return favorites.includes(m.symbol);
      if (activeTab === "Crypto") return m.category === "crypto" || !m.category;
      if (activeTab === "RWA") return m.category === "equity";
      if (activeTab === "Perps") return true;
      return true;
    });
  }, [searchQuery, activeTab, favorites]);

  // Crypto Hot markets with guarded price consistency
  const hotCryptoMarkets: MarketWithMetrics[] = useMemo(() => {
    return SUPPORTED_MARKETS.filter((m) => m.category === "crypto" || !m.category).map((m) => {
      const isSelected = m.symbol === selectedMarket.symbol;
      const isEth = m.symbol.includes("ETH");
      const isBtc = m.symbol.includes("BTC");
      const isRealisticPrice = isSelected && Math.abs(stats.markPrice - m.basePrice) / m.basePrice < 0.5;
      const mPrice = isRealisticPrice ? stats.markPrice : isEth ? 2450.0 : isBtc ? 65420.0 : 142.5;
      const mChange = isRealisticPrice ? priceChange : isEth ? 1.25 : isBtc ? -0.72 : 2.45;
      return {
        ...m,
        displayPrice: mPrice,
        displayChange: mChange,
        isPositive: mChange >= 0,
      };
    });
  }, [selectedMarket.symbol, stats.markPrice, priceChange]);

  // Tokenized Stock / RWA markets (NVDA, TSLA, COIN, SPY) with guarded price consistency
  const hotStockMarkets: MarketWithMetrics[] = useMemo(() => {
    return SUPPORTED_MARKETS.filter((m) => m.category === "equity").map((m) => {
      const isSelected = m.symbol === selectedMarket.symbol;
      const isRealisticPrice = isSelected && Math.abs(stats.markPrice - m.basePrice) / m.basePrice < 0.5;
      const mPrice = isRealisticPrice ? stats.markPrice : m.basePrice;
      const mChange = isRealisticPrice
        ? priceChange
        : m.symbol.includes("NVDA")
        ? 3.42
        : m.symbol.includes("TSLA")
        ? -1.15
        : m.symbol.includes("COIN")
        ? 4.18
        : 0.65;
      return {
        ...m,
        displayPrice: mPrice,
        displayChange: mChange,
        isPositive: mChange >= 0,
      };
    });
  }, [selectedMarket.symbol, stats.markPrice, priceChange]);

  const favoriteMarketsList: MarketWithMetrics[] = useMemo(() => {
    const all = [...hotCryptoMarkets, ...hotStockMarkets];
    return all.filter((m) => favorites.includes(m.symbol));
  }, [hotCryptoMarkets, hotStockMarkets, favorites]);

  return (
    <div className="relative z-40 flex h-11 shrink-0 items-center border-b border-[#e2e5eb] dark:border-[#1e1e1e] bg-white dark:bg-[#000000] px-3 text-xs select-none">
      {/* ─── 1. Compact Inline Token Selector (Lighter Style) ─── */}
      <div className="relative overflow-visible shrink-0">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            "flex items-center gap-1.5 py-1 px-1.5 sm:px-2 rounded-md transition-colors cursor-pointer group",
            dropdownOpen
              ? "bg-accent/10 text-accent font-semibold"
              : "hover:bg-[#f0f2f5] dark:hover:bg-[#121212] text-foreground"
          )}
          aria-haspopup="dialog"
          aria-expanded={dropdownOpen}
        >
          <MarketTokenIcon symbol={selectedMarket.symbol} className="h-4 w-4" />
          <span className="font-bold text-xs sm:text-sm tracking-tight text-foreground">
            {selectedMarket.symbol.replace("-PERP", "")}
          </span>
          {selectedMarket.category === "equity" ? (
            <span className="rounded bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-1 py-0.2 text-[8px] font-mono font-bold">
              RWA
            </span>
          ) : (
            <span className="rounded bg-[#eaedf2] dark:bg-[#181818] px-1 py-0.2 text-[9px] font-mono font-semibold text-foreground-muted">
              {selectedMarket.maxLeverage}x
            </span>
          )}
          <RuneIcon
            name="arrows-chevron-down"
            className={cn(
              "h-3 w-3 text-foreground-muted transition-transform duration-200 group-hover:text-foreground",
              dropdownOpen && "rotate-180"
            )}
          />
        </button>

        {/* ─── Institutional Market Search Modal (Rendered via Portal to avoid any container clipping) ─── */}
        {dropdownOpen && mounted && createPortal(
          <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Fullscreen Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs pointer-events-auto transition-opacity"
              onClick={() => setDropdownOpen(false)}
            />

            {/* Modal Box */}
            <div
              style={{
                position: "fixed",
                top: `${modalPos.top}px`,
                left: `${modalPos.left}px`,
                maxHeight: `min(560px, calc(100vh - ${modalPos.top + 20}px))`,
              }}
              className="pointer-events-auto w-[calc(100vw-24px)] sm:w-[780px] md:w-[840px] rounded-2xl border border-border/80 dark:border-white/10 bg-background/98 dark:bg-[#0c0c0e]/98 shadow-2xl backdrop-blur-2xl p-4 flex flex-col z-[10000] animate-in fade-in-0 zoom-in-95 font-sans overflow-hidden"
            >
              {/* Search Bar */}
              <div className="flex items-center gap-2.5 rounded-xl border border-border/80 dark:border-white/10 bg-[#f7f8fb] dark:bg-[#141416] px-3.5 py-2 shrink-0">
                <RuneIcon name="tools-magnifying-glass" className="h-3.5 w-3.5 text-foreground-muted shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Markets by name or symbol (e.g. NVDA, TSLA, ETH)..."
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-foreground-muted/70 outline-none font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-foreground-muted hover:text-foreground cursor-pointer"
                  >
                    <RuneIcon name="indicators-x" className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Sub-Nav Category Tabs */}
              <div className="flex items-center gap-1.5 mt-2.5 pb-2 border-b border-border/60 dark:border-white/10 overflow-x-auto no-scrollbar shrink-0">
                {(
                  [
                    { id: "Featured", label: "Featured" },
                    { id: "All", label: "All Markets" },
                    { id: "Crypto", label: "Crypto" },
                    { id: "RWA", label: "Stocks / RWA" },
                    { id: "Favorites", label: "Favorites" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as MarketCategoryTab)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5",
                      activeTab === tab.id
                        ? "bg-accent/10 text-accent font-semibold border border-accent/25"
                        : "text-foreground-muted hover:text-foreground hover:bg-surface dark:hover:bg-white/[0.04]"
                    )}
                  >
                    {tab.id === "Featured" && (
                      <RuneIcon name="tools-sparkles" className="h-3 w-3 text-accent shrink-0" />
                    )}
                    {tab.id === "RWA" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                    {tab.id === "Favorites" && (
                      <RuneIcon name="tools-star" className="h-3 w-3 text-amber-400 shrink-0" />
                    )}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              {activeTab === "Featured" && !searchQuery ? (
                /* ─── Institutional 3-Column Grid: CRYPTO | TOKENIZED STOCKS | FAVORITES ─── */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3 min-h-0 overflow-hidden flex-1">
                  {/* Column 1: CRYPTO PERPS */}
                  <div className="flex flex-col min-h-0">
                    <div className="flex items-center justify-between pb-2 px-1 shrink-0">
                      <span className="text-[11px] font-semibold tracking-wide text-foreground flex items-center gap-1.5">
                        <span>CRYPTO PERPS</span>
                        <RuneIcon name="other-zap" className="h-3 w-3 text-amber-500 fill-amber-500/20" />
                      </span>
                      <span className="text-[10px] font-mono text-foreground-muted bg-surface dark:bg-white/[0.05] border border-border/40 dark:border-white/10 px-1.5 py-0.2 rounded-md">
                        {hotCryptoMarkets.length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 mt-0.5 max-h-[340px] overflow-y-auto no-scrollbar pr-0.5 flex-1">
                      {hotCryptoMarkets.map((m) => {
                        const isFav = favorites.includes(m.symbol);
                        const isSelected = m.symbol === selectedMarket.symbol;
                        return (
                          <MarketCardItem
                            key={m.symbol}
                            market={m}
                            isSelected={isSelected}
                            isFav={isFav}
                            onSelect={() => {
                              setSelectedMarket(m);
                              setDropdownOpen(false);
                            }}
                            onToggleFav={(e) => toggleFavorite(e, m.symbol)}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 2: TOKENIZED STOCKS / RWA */}
                  <div className="flex flex-col min-h-0 border-t sm:border-t-0 sm:border-l border-border/60 dark:border-white/10 sm:pl-3.5 pt-2.5 sm:pt-0">
                    <div className="flex items-center justify-between pb-2 px-1 shrink-0">
                      <span className="text-[11px] font-semibold tracking-wide text-foreground flex items-center gap-1.5">
                        <span>STOCKS / RWA</span>
                        <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 text-[8px] font-bold">
                          USDC
                        </span>
                      </span>
                      <span className="text-[10px] font-mono text-foreground-muted bg-surface dark:bg-white/[0.05] border border-border/40 dark:border-white/10 px-1.5 py-0.2 rounded-md">
                        {hotStockMarkets.length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 mt-0.5 max-h-[340px] overflow-y-auto no-scrollbar pr-0.5 flex-1">
                      {hotStockMarkets.map((m) => {
                        const isFav = favorites.includes(m.symbol);
                        const isSelected = m.symbol === selectedMarket.symbol;
                        return (
                          <MarketCardItem
                            key={m.symbol}
                            market={m}
                            isSelected={isSelected}
                            isFav={isFav}
                            onSelect={() => {
                              setSelectedMarket(m);
                              setDropdownOpen(false);
                            }}
                            onToggleFav={(e) => toggleFavorite(e, m.symbol)}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 3: FAVORITES */}
                  <div className="flex flex-col min-h-0 border-t sm:border-t-0 sm:border-l border-border/60 dark:border-white/10 sm:pl-3.5 pt-2.5 sm:pt-0">
                    <div className="flex items-center justify-between pb-2 px-1 shrink-0">
                      <span className="text-[11px] font-semibold tracking-wide text-foreground flex items-center gap-1.5">
                        <span>FAVORITES</span>
                        <RuneIcon name="tools-star" className="h-3 w-3 text-amber-400 fill-amber-400/20" />
                      </span>
                      <span className="text-[10px] font-mono text-foreground-muted bg-surface dark:bg-white/[0.05] border border-border/40 dark:border-white/10 px-1.5 py-0.2 rounded-md">
                        {favoriteMarketsList.length}
                      </span>
                    </div>

                    {favoriteMarketsList.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-foreground-muted border border-dashed border-border/60 rounded-xl mt-0.5">
                        <RuneIcon name="tools-star" className="h-6 w-6 mb-2 opacity-30 text-amber-400" />
                        <span className="text-xs font-medium">
                          No favorite markets yet.
                        </span>
                        <span className="text-[10px] text-foreground-faint mt-0.5">
                          Click star on any market to add
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 mt-0.5 max-h-[340px] overflow-y-auto no-scrollbar pr-0.5 flex-1">
                        {favoriteMarketsList.map((m) => {
                          const isSelected = m.symbol === selectedMarket.symbol;
                          return (
                            <MarketCardItem
                              key={m.symbol}
                              market={m}
                              isSelected={isSelected}
                              isFav={true}
                              onSelect={() => {
                                setSelectedMarket(m);
                                setDropdownOpen(false);
                              }}
                              onToggleFav={(e) => toggleFavorite(e, m.symbol)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (

                /* ─── Search or Full Market List View ─── */
                <div className="flex flex-col mt-2 max-h-[340px] overflow-y-auto no-scrollbar font-mono text-xs flex-1">
                  {filteredMarkets.length === 0 ? (
                    <div className="py-10 text-center text-foreground-muted text-xs">
                      No markets found matching &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    filteredMarkets.map((m) => {
                      const isSelected = m.symbol === selectedMarket.symbol;
                      const isRealisticPrice = isSelected && Math.abs(stats.markPrice - m.basePrice) / m.basePrice < 0.5;
                      const mPrice = isRealisticPrice ? stats.markPrice : m.basePrice;
                      const mChange = isRealisticPrice
                        ? priceChange
                        : m.symbol.includes("NVDA")
                        ? 3.42
                        : m.symbol.includes("TSLA")
                        ? -1.15
                        : m.symbol.includes("COIN")
                        ? 4.18
                        : m.symbol.includes("SPY")
                        ? 0.65
                        : m.symbol.includes("BTC")
                        ? -0.72
                        : m.symbol.includes("SOL")
                        ? 2.45
                        : 1.25;
                      const isRowPositive = mChange >= 0;
                      const isFav = favorites.includes(m.symbol);

                      return (
                        <div
                          key={m.symbol}
                          onClick={() => {
                            setSelectedMarket(m);
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            "grid grid-cols-12 items-center px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer group",
                            isSelected
                              ? "bg-[#e5e8ee] dark:bg-[#1a1a1a] text-foreground font-semibold"
                              : "hover:bg-[#f0f2f6] dark:hover:bg-[#121212] text-foreground"
                          )}
                        >
                          {/* Asset Info */}
                          <div className="col-span-5 flex items-center gap-2">
                            <MarketTokenIcon symbol={m.symbol} className="h-5 w-5 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-xs tracking-tight text-foreground truncate">
                                  {m.symbol}
                                </span>
                                {m.category === "equity" ? (
                                  <span className="rounded bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 text-[8px] font-mono font-bold">
                                    RWA
                                  </span>
                                ) : (
                                  <span className="rounded bg-[#eaedf2] dark:bg-[#181818] px-1 py-0.2 text-[9px] font-mono font-medium text-foreground-muted">
                                    {m.maxLeverage}x
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-foreground-muted truncate">
                                {m.name}
                              </span>
                            </div>
                          </div>

                          {/* Last Price */}
                          <div className="col-span-3 text-right font-semibold text-foreground text-xs">
                            {formatPrice(mPrice)}
                          </div>

                          {/* 24h Change */}
                          <div
                            className={cn(
                              "col-span-2 text-right font-semibold text-xs",
                              isRowPositive ? "text-positive" : "text-negative"
                            )}
                          >
                            {isRowPositive ? "+" : ""}
                            {mChange.toFixed(2)}%
                          </div>

                          <div className="col-span-2 flex justify-end">
                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(e, m.symbol)}
                              className="text-foreground-muted hover:text-amber-500 cursor-pointer p-1"
                              title="Favorite"
                            >
                              <RuneIcon
                                name="tools-star"
                                styleVariant={isFav ? "fill" : "normal"}
                                className={cn(
                                  "h-3.5 w-3.5 transition-colors",
                                  isFav ? "text-amber-400 fill-amber-400" : "text-foreground-muted hover:text-foreground"
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Keyboard Footer Hint */}
              <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-border/60 dark:border-white/10 px-1 text-[9px] font-mono text-foreground-muted shrink-0">
                <span>Press Esc to close</span>
                <span>Pyth Protocol Stream</span>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* ─── 2. Continuous Institutional Metrics Strip (Exact Lighter Layout) ─── */}
      <div className="flex flex-1 items-center gap-4 sm:gap-6 md:gap-7 overflow-hidden font-mono min-w-0 ml-3 sm:ml-4">
        {/* MARK PRICE */}
        <div className="flex flex-col shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted font-sans font-medium">
            MARK PRICE
          </span>
          <span
            className={cn(
              "text-xs font-mono font-bold transition-colors duration-200",
              priceFlash === "up" && "text-positive",
              priceFlash === "down" && "text-negative",
              !priceFlash && (isPositive ? "text-positive" : "text-negative")
            )}
          >
            {stats.markPrice ? stats.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "2,483.51"}
          </span>
        </div>

        {/* INDEX PRICE */}
        <div className="flex flex-col shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted font-sans font-medium">
            INDEX PRICE
          </span>
          <span className="text-xs font-mono font-medium text-foreground">
            {index ? index.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "2,484.87"}
          </span>
        </div>

        {/* 24H CHANGE */}
        <div className="flex flex-col shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted font-sans font-medium">
            24H CHANGE
          </span>
          <span
            className={cn(
              "text-xs font-mono font-semibold",
              isPositive ? "text-positive" : "text-negative"
            )}
          >
            {formatSignedPercent(priceChange)}
          </span>
        </div>

        {/* 24H VOLUME */}
        <div className="hidden sm:flex flex-col shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted font-sans font-medium">
            24H VOLUME
          </span>
          <span className="text-xs font-mono font-medium text-foreground">
            {formatUsd(volume, 2, 2)}
          </span>
        </div>

        {/* OPEN INTEREST */}
        <div className="hidden md:flex flex-col shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted font-sans font-medium">
            OPEN INTEREST
          </span>
          <span className="text-xs font-mono font-medium text-foreground">
            {formatUsd(openInterest, 2, 2)}
          </span>
        </div>

        {/* 1HR FUNDING */}
        <div className="hidden lg:flex flex-col shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted font-sans font-medium">
            1HR FUNDING
          </span>
          <span className="text-xs font-mono font-semibold text-accent">
            +{(funding * 100).toFixed(4)}%
          </span>
        </div>

        {/* NEXT FUNDING */}
        <div className="hidden xl:flex flex-col shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted font-sans font-medium">
            NEXT FUNDING
          </span>
          <span className="text-xs font-mono font-medium text-foreground">
            {countdown}
          </span>
        </div>
      </div>

      {/* ─── 3. Right: Pyth Oracle Status ─── */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-foreground-muted shrink-0 pl-2 ml-auto">
        <span className="h-1.5 w-1.5 rounded-full bg-[#0ecb81] animate-pulse" />
        <span className="hidden lg:inline text-foreground-muted">Pyth Oracle</span>
        <span className="text-foreground font-semibold">{pythLatencyMs}ms</span>
      </div>
    </div>
  );
}

export default MarketTickerBar;
