"use client";

import React, { useEffect, useRef, memo } from "react";

interface TradingViewWidgetProps {
  symbol: string; // e.g. "ETHUSDT" or "BINANCE:ETHUSDT"
  theme?: "dark" | "light";
  interval?: string;
  className?: string;
}

function TradingViewWidgetComponent({
  symbol,
  theme = "dark",
  interval = "15",
  className = "",
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Support equity exchange tickers (e.g. NASDAQ:NVDA, AMEX:SPY) or crypto Binance pairs
  let formattedSymbol = symbol;
  if (symbol.includes(":")) {
    formattedSymbol = symbol;
  } else if (symbol.includes("NVDA") || symbol.includes("TSLA") || symbol.includes("AAPL") || symbol.includes("COIN") || symbol.includes("MSFT") || symbol.includes("GOOGL")) {
    const ticker = symbol.replace("-PERP", "").replace("USDT", "");
    formattedSymbol = `NASDAQ:${ticker}`;
  } else if (symbol.includes("SPY") || symbol.includes("QQQ")) {
    const ticker = symbol.replace("-PERP", "").replace("USDT", "");
    formattedSymbol = `AMEX:${ticker}`;
  } else {
    const cleanSymbol = symbol.replace("-PERP", "USDT").replace("/", "");
    formattedSymbol = cleanSymbol.startsWith("BINANCE:")
      ? cleanSymbol
      : `BINANCE:${cleanSymbol}`;
  }

  // Map timeframe strings to TradingView interval format
  const getTvInterval = (tf: string) => {
    switch (tf) {
      case "1m":
        return "1";
      case "5m":
        return "5";
      case "15m":
        return "15";
      case "1h":
        return "60";
      case "4h":
        return "240";
      case "1d":
      case "1D":
        return "D";
      default:
        return tf;
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset container contents
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: formattedSymbol,
      interval: getTvInterval(interval),
      timezone: "Etc/UTC",
      theme: theme === "light" ? "light" : "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: false,
      calendar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      backgroundColor: theme === "light" ? "#ffffff" : "#000000",
      gridColor: theme === "light" ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.03)",
      hide_side_toolbar: false,
      withdateranges: true,
      details: false,
      hotlist: false,
      show_popup_button: false,
      popup_width: "1000",
      popup_height: "650",
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [formattedSymbol, theme, interval]);

  return (
    <div
      ref={containerRef}
      className={`tradingview-widget-container w-full h-full relative overflow-hidden bg-background ${className}`}
      style={{ minHeight: "200px", height: "100%" }}
    />
  );
}

export const TradingViewWidget = memo(TradingViewWidgetComponent);
