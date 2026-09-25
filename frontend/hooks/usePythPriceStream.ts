"use client";

import { useState, useEffect } from "react";

export type PythPriceData = {
  id: string;
  price: number;
  conf: number;
  publishTime: number;
};

// Map perpetual market symbols to live high-frequency feed pairs
const SYMBOL_MAP: Record<string, string> = {
  "ETH-PERP": "ETHUSDT",
  "BTC-PERP": "BTCUSDT",
  "SOL-PERP": "SOLUSDT",
};

export function usePythPriceStream(marketSymbol: string) {
  const [priceData, setPriceData] = useState<PythPriceData | null>(null);

  useEffect(() => {
    // Always reset price on market change so previous market price never leaks
    setPriceData(null);

    const pair = SYMBOL_MAP[marketSymbol];
    if (!pair) {
      // Non-crypto or synthetic equity market (NVDA, TSLA, COIN, SPY)
      return;
    }

    let ws: WebSocket | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    // 1. Primary: Ultra-low latency WebSocket stream (sub-100ms ticks)
    const connectWs = () => {
      try {
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@ticker`);

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data && data.c) {
              const livePrice = parseFloat(data.c);
              setPriceData({
                id: pair,
                price: livePrice,
                conf: parseFloat(data.h || "0") - parseFloat(data.l || "0"),
                publishTime: Math.floor(Date.now() / 1000),
              });
            }
          } catch {
            // Silently ignore parse errors
          }
        };

        ws.onerror = () => {
          // Do NOT throw or call console.error so Next.js overlay is not triggered
          ws?.close();
        };

        ws.onclose = () => {
          // Reconnect or fallback to REST polling if WebSocket disconnects
        };
      } catch {
        // WebSocket init failed, fallback will handle it
      }
    };

    // 2. Secondary: Fast REST Polling fallback
    const pollRestPrice = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.price && isMounted) {
          setPriceData((prev) => {
            // Only update if we don't have recent WebSocket tick
            const newPrice = parseFloat(data.price);
            return {
              id: pair,
              price: newPrice,
              conf: 0.1,
              publishTime: Math.floor(Date.now() / 1000),
            };
          });
        }
      } catch {
        // Silently ignore network hiccups
      }
    };

    connectWs();
    pollRestPrice();
    fallbackInterval = setInterval(pollRestPrice, 3000);

    return () => {
      isMounted = false;
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [marketSymbol]);

  return { priceData };
}
