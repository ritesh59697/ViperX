"use client";

import { useState, useEffect, useCallback } from "react";
import { PerpMarket } from "@/lib/trade/tradeStore";

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
  depthPercent: number;
}

export interface OrderBookData {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  midPrice: number;
}

export function useOrderBook(market: PerpMarket, markPrice: number) {
  const [orderBook, setOrderBook] = useState<OrderBookData>({
    asks: [],
    bids: [],
    spread: 0,
    spreadPercent: 0,
    midPrice: markPrice || market.basePrice,
  });

  const fetchRealDepth = useCallback(async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/depth?symbol=${market.binanceSymbol}&limit=12`
      );
      if (res.ok) {
        const data = await res.json();
        
        let cumAsk = 0;
        const rawAsks = (data.asks as [string, string][]).map(([p, s]) => {
          const price = parseFloat(p);
          const size = parseFloat(s);
          cumAsk += size;
          return { price, size, total: cumAsk };
        });

        let cumBid = 0;
        const rawBids = (data.bids as [string, string][]).map(([p, s]) => {
          const price = parseFloat(p);
          const size = parseFloat(s);
          cumBid += size;
          return { price, size, total: cumBid };
        });

        const maxTotal = Math.max(cumAsk, cumBid) || 1;

        const asks: OrderBookLevel[] = rawAsks.map((item) => ({
          ...item,
          depthPercent: Math.min(100, Math.round((item.total / maxTotal) * 100)),
        }));

        const bids: OrderBookLevel[] = rawBids.map((item) => ({
          ...item,
          depthPercent: Math.min(100, Math.round((item.total / maxTotal) * 100)),
        }));

        const bestAsk = asks[0]?.price || markPrice * 1.0001;
        const bestBid = bids[0]?.price || markPrice * 0.9999;
        const spread = Math.max(0, bestAsk - bestBid);
        const spreadPercent = (spread / (bestAsk || 1)) * 100;
        const midPrice = (bestAsk + bestBid) / 2;

        setOrderBook({
          asks,
          bids,
          spread,
          spreadPercent,
          midPrice,
        });
        return;
      }
    } catch {
      // Fallback generator below if network drops
    }

    // High fidelity fallback simulator anchored to current markPrice
    const p = markPrice > 0 ? markPrice : market.basePrice;
    const step = p * 0.00015;
    let askTotal = 0;
    const asks: OrderBookLevel[] = [];
    for (let i = 1; i <= 10; i++) {
      const price = p + i * step;
      const size = Math.round((1.5 + Math.random() * 8.5) * 100) / 100;
      askTotal += size;
      asks.push({ price, size, total: askTotal, depthPercent: 0 });
    }

    let bidTotal = 0;
    const bids: OrderBookLevel[] = [];
    for (let i = 1; i <= 10; i++) {
      const price = p - i * step;
      const size = Math.round((1.5 + Math.random() * 8.5) * 100) / 100;
      bidTotal += size;
      bids.push({ price, size, total: bidTotal, depthPercent: 0 });
    }

    const maxT = Math.max(askTotal, bidTotal) || 1;
    asks.forEach((a) => (a.depthPercent = Math.min(100, Math.round((a.total / maxT) * 100))));
    bids.forEach((b) => (b.depthPercent = Math.min(100, Math.round((b.total / maxT) * 100))));

    setOrderBook({
      asks,
      bids,
      spread: step,
      spreadPercent: (step / p) * 100,
      midPrice: p,
    });
  }, [market.binanceSymbol, market.basePrice, markPrice]);

  useEffect(() => {
    fetchRealDepth();
    const timer = setInterval(fetchRealDepth, 2000);
    return () => clearInterval(timer);
  }, [fetchRealDepth]);

  return orderBook;
}
