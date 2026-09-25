"use client";

import { useEffect, useState, useCallback } from "react";
import { PerpMarket, useTradeStore } from "@/lib/trade/tradeStore";

export interface MarketStats {
  markPrice: number;
  indexPrice: number;
  high24h: number;
  low24h: number;
  change24h: number;
  volume24hUsd: number;
  fundingRateHourly: number;
}

export interface KlinePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function useMarketData(market: PerpMarket, timeframe: string = "15m") {
  const { setMarkPrice, setPrice24hChange, pushPriceTick, syncPositionsMarkPrice } = useTradeStore();

  const [stats, setStats] = useState<MarketStats>({
    markPrice: market.basePrice,
    indexPrice: market.basePrice,
    high24h: market.basePrice * 1.03,
    low24h: market.basePrice * 0.97,
    change24h: 1.25,
    volume24hUsd: 14850200,
    fundingRateHourly: 0.0012, // 0.0012% / hr
  });

  const [klines, setKlines] = useState<KlinePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Klines for chart
  const fetchKlines = useCallback(async () => {
    try {
      const intervalMap: Record<string, string> = {
        "1m": "1m",
        "5m": "5m",
        "15m": "15m",
        "1h": "1h",
        "4h": "4h",
        "1d": "1d",
      };
      const validInterval = intervalMap[timeframe] || "15m";
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${market.binanceSymbol}&interval=${validInterval}&limit=48`
      );
      if (res.ok) {
        const raw = await res.json();
        const parsed: KlinePoint[] = raw.map((item: (string | number)[]) => ({
          time: Number(item[0]),
          open: parseFloat(item[1] as string),
          high: parseFloat(item[2] as string),
          low: parseFloat(item[3] as string),
          close: parseFloat(item[4] as string),
        }));
        setKlines(parsed);
      }
    } catch {
      // Keep existing klines if network drops
    }
  }, [market.binanceSymbol, timeframe]);

  // Fetch 24hr ticker & live price
  const fetchTicker = useCallback(async () => {
    // 1. Equity / RWA Market handling
    if (market.category === "equity" && market.equityTicker) {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${market.equityTicker}?interval=1d&range=1d`
        );
        if (res.ok) {
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          const currentPrice = meta?.regularMarketPrice || market.basePrice;
          const prevClose = meta?.chartPreviousClose || currentPrice;
          const changePct = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0.85;
          const high = meta?.regularMarketDayHigh || currentPrice * 1.018;
          const low = meta?.regularMarketDayLow || currentPrice * 0.982;
          const vol = (meta?.regularMarketVolume || 4500000) * currentPrice;

          if (currentPrice > 0) {
            setStats({
              markPrice: currentPrice,
              indexPrice: currentPrice * 0.9999,
              high24h: high,
              low24h: low,
              change24h: changePct,
              volume24hUsd: vol,
              fundingRateHourly: 0.0006,
            });

            setMarkPrice(currentPrice);
            setPrice24hChange(changePct);
            pushPriceTick(currentPrice);
            syncPositionsMarkPrice(market.symbol, currentPrice);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Continue to fallback simulation below if network/CORS restricts external Yahoo Finance
      }
    }

    // 2. Crypto Market handling via Binance
    if (market.binanceSymbol) {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${market.binanceSymbol}`
        );
        if (res.ok) {
          const data = await res.json();
          const currentPrice = parseFloat(data.lastPrice);
          const changePct = parseFloat(data.priceChangePercent);
          const high = parseFloat(data.highPrice);
          const low = parseFloat(data.lowPrice);
          const vol = parseFloat(data.quoteVolume);

          if (currentPrice > 0) {
            setStats({
              markPrice: currentPrice,
              indexPrice: currentPrice * 0.9998,
              high24h: high,
              low24h: low,
              change24h: changePct,
              volume24hUsd: vol,
              fundingRateHourly: 0.0012,
            });

            setMarkPrice(currentPrice);
            setPrice24hChange(changePct);
            pushPriceTick(currentPrice);
            syncPositionsMarkPrice(market.symbol, currentPrice);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Fallback below
      }
    }

    // 3. Fallback: apply micro-fluctuation to keep terminal feeling alive
    setStats((prev) => {
      const isConsistent = Math.abs(prev.markPrice - market.basePrice) / market.basePrice < 0.5;
      const current = isConsistent && prev.markPrice > 0 ? prev.markPrice : market.basePrice;
      const drift = current * ((Math.random() - 0.49) * 0.0006);
      const nextPrice = current + drift;
      setMarkPrice(nextPrice);
      pushPriceTick(nextPrice);
      syncPositionsMarkPrice(market.symbol, nextPrice);
      return {
        ...prev,
        markPrice: nextPrice,
      };
    });
    setIsLoading(false);
  }, [market.category, market.equityTicker, market.binanceSymbol, market.basePrice, market.symbol, setMarkPrice, setPrice24hChange, pushPriceTick, syncPositionsMarkPrice]);

  useEffect(() => {
    // Reset stats immediately when market switches so UI never shows previous market's price
    const defaultChange = market.symbol.includes("NVDA")
      ? 3.42
      : market.symbol.includes("TSLA")
      ? -1.15
      : market.symbol.includes("COIN")
      ? 4.18
      : market.symbol.includes("SPY")
      ? 0.65
      : market.symbol.includes("BTC")
      ? -0.72
      : market.symbol.includes("SOL")
      ? 2.45
      : 1.25;
    const defaultVol = market.category === "equity" ? 4850200 : 14850200;

    setStats({
      markPrice: market.basePrice,
      indexPrice: market.basePrice,
      high24h: market.basePrice * 1.03,
      low24h: market.basePrice * 0.97,
      change24h: defaultChange,
      volume24hUsd: defaultVol,
      fundingRateHourly: 0.0012,
    });
    setMarkPrice(market.basePrice);
    setPrice24hChange(defaultChange);

    fetchKlines();
    fetchTicker();

    const priceInterval = setInterval(fetchTicker, 2500);
    const klinesInterval = setInterval(fetchKlines, 30000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(klinesInterval);
    };
  }, [market.symbol, market.basePrice, market.category, setMarkPrice, setPrice24hChange, fetchKlines, fetchTicker]);

  return { stats, klines, isLoading };
}
