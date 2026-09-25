"use client";

import React, { useState, useMemo } from "react";
import { useTradeStore } from "@/lib/trade/tradeStore";
import {
  calcPositionSize,
  calcTradingFee,
  calcLiquidationPrice,
  calcProjectedPnl,
  formatUsd,
  formatPrice,
  formatSignedPercent,
} from "@/lib/trade/math";
import { AI_STRATEGIES } from "./AiCoPilotPanel";
import { RuneIcon } from "@/components/ui/RuneIcon";
import { cn } from "@/lib/utils";

interface OrderFormPanelProps {
  markPrice: number;
  isWalletConnected: boolean;
  isSubmitting: boolean;
  submitStatusText: string;
  availableBalanceUsd?: number;
  onOpenPosition: () => void;
  onConnectWallet: () => void;
}

export function OrderFormPanel({
  markPrice,
  isWalletConnected,
  isSubmitting,
  submitStatusText,
  availableBalanceUsd = 0,
  onOpenPosition,
  onConnectWallet,
}: OrderFormPanelProps) {
  const {
    selectedMarket,
    selectedChain,
    side,
    setSide,
    leverage,
    setLeverage,
    collateralInput,
    setCollateralInput,
    takeProfitInput,
    setTakeProfitInput,
    stopLossInput,
    setStopLossInput,
    slippageTolerance,
    setSlippageTolerance,
    reduceOnly,
    setReduceOnly,
    useAgentDelegation,
    setUseAgentDelegation,
    selectedAgentStrategy,
    setSelectedAgentStrategy,
  } = useTradeStore();

  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPriceInput, setLimitPriceInput] = useState("");
  const [enableTpSl, setEnableTpSl] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Sync limit price default
  const effectivePrice =
    orderType === "limit" && parseFloat(limitPriceInput) > 0
      ? parseFloat(limitPriceInput)
      : markPrice;

  const collateralNumber = parseFloat(collateralInput) || 0;
  const positionSizeUsd = calcPositionSize(collateralNumber, leverage);
  const tradingFeeUsd = calcTradingFee(positionSizeUsd);
  const estimatedLiqPrice = calcLiquidationPrice(side, effectivePrice, leverage, 0.05);

  // Projected TP / SL PnL
  const tpNumber = parseFloat(takeProfitInput) || 0;
  const slNumber = parseFloat(stopLossInput) || 0;
  const projectedTp = useMemo(() => {
    return calcProjectedPnl(side, positionSizeUsd, effectivePrice, tpNumber);
  }, [side, positionSizeUsd, effectivePrice, tpNumber]);

  const projectedSl = useMemo(() => {
    return calcProjectedPnl(side, positionSizeUsd, effectivePrice, slNumber);
  }, [side, positionSizeUsd, effectivePrice, slNumber]);

  const isLong = side === "long";

  // Selected AI Strategy
  const currentStrategy = useMemo(() => {
    return (
      AI_STRATEGIES.find((s) => s.id === selectedAgentStrategy) ||
      AI_STRATEGIES[0]
    );
  }, [selectedAgentStrategy]);

  // Handle AI Auto-fill levels
  const handleApplyAiLevels = () => {
    if (effectivePrice <= 0) return;
    setEnableTpSl(true);
    if (isLong) {
      const tp = effectivePrice * currentStrategy.tpMultiplier;
      const sl = effectivePrice * currentStrategy.slMultiplier;
      setTakeProfitInput(tp.toFixed(2));
      setStopLossInput(sl.toFixed(2));
    } else {
      const tp = effectivePrice * (2 - currentStrategy.tpMultiplier);
      const sl = effectivePrice * (2 - currentStrategy.slMultiplier);
      setTakeProfitInput(tp.toFixed(2));
      setStopLossInput(sl.toFixed(2));
    }
  };


  return (
    <div className="flex w-full flex-col bg-white dark:bg-[#000000] p-3 text-xs text-foreground select-none">
      {/* ─── 1. Primary Long / Short Segmented Switcher (Lighter Style) ─── */}
      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-[#ebedf2] dark:bg-[#080808] border border-[#d2d6df] dark:border-[#1e1e1e]">
        <button
          type="button"
          onClick={() => setSide("long")}
          className={cn(
            "py-2 px-3 rounded-md font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5",
            isLong
              ? "bg-[#0ecb81] text-white shadow-xs"
              : "text-foreground-muted hover:text-foreground hover:bg-[#dfe2e8] dark:hover:bg-[#121212]"
          )}
        >
          <span>Buy / Long</span>
        </button>

        <button
          type="button"
          onClick={() => setSide("short")}
          className={cn(
            "py-2 px-3 rounded-md font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5",
            !isLong
              ? "bg-[#f6465d] text-white shadow-xs"
              : "text-foreground-muted hover:text-foreground hover:bg-[#dfe2e8] dark:hover:bg-[#121212]"
          )}
        >
          <span>Sell / Short</span>
        </button>
      </div>

      {/* ─── 2. Order Type & AI Co-Pilot Toggle ─── */}
      <div className="flex items-center justify-between mt-2.5 px-0.5 pb-1 border-b border-[#e2e5eb] dark:border-[#1e1e1e]">
        {/* Order Type Tabs */}
        <div className="flex items-center gap-3 font-medium">
          <button
            type="button"
            onClick={() => setOrderType("market")}
            className={cn(
              "text-xs transition-colors cursor-pointer py-1 relative",
              orderType === "market"
                ? "text-foreground font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:rounded-full"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            Market
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderType("limit");
              if (!limitPriceInput && markPrice > 0) {
                setLimitPriceInput(markPrice.toFixed(selectedMarket.precision));
              }
            }}
            className={cn(
              "text-xs transition-colors cursor-pointer py-1 relative",
              orderType === "limit"
                ? "text-foreground font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:rounded-full"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            Limit
          </button>
        </div>

        {/* Viper Co-Pilot Institutional Toggle (Quiet, calm) */}
        <button
          type="button"
          onClick={() => setUseAgentDelegation(!useAgentDelegation)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer border",
            useAgentDelegation
              ? "bg-[#f0f2f6] text-foreground border-[#d2d6df] dark:bg-[#121212] dark:border-[#222222] font-semibold shadow-xs"
              : "border-transparent text-foreground-muted hover:text-foreground"
          )}
          title="Toggle Viper AI Co-Pilot automated execution"
        >
          <RuneIcon name="tools-sparkles" className="h-3 w-3 text-accent" />
          <span>AI Co-Pilot</span>
        </button>
      </div>

      {/* ─── 3. Limit Price Input (if limit order active) ─── */}
      {orderType === "limit" && (
        <div className="flex flex-col gap-1 mt-2.5 animate-in fade-in-0 duration-150">
          <div className="flex justify-between text-[11px] font-mono text-foreground-muted">
            <span>Limit Price</span>
            <button
              type="button"
              onClick={() => setLimitPriceInput(markPrice.toFixed(selectedMarket.precision))}
              className="text-accent hover:underline cursor-pointer"
            >
              Mid: {formatPrice(markPrice)}
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#d2d6df] dark:border-[#222222] bg-[#f8f9fb] dark:bg-[#080808] px-3 py-2 font-mono focus-within:border-foreground/60 transition-colors">
            <input
              type="number"
              value={limitPriceInput}
              onChange={(e) => setLimitPriceInput(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent text-foreground outline-none text-xs font-semibold"
            />
            <span className="text-[11px] font-semibold text-foreground-muted pl-2">USD</span>
          </div>
        </div>
      )}

      {/* ─── 4. Collateral Amount Input ─── */}
      <div className="flex flex-col gap-1.5 mt-2.5">
        <div className="flex justify-between items-center text-[11px] font-mono text-foreground-muted">
          <span>Available to Trade</span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">
              ${isWalletConnected ? availableBalanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"} USDC
            </span>
            {isWalletConnected && (
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent hover:underline flex items-center gap-1 ml-1 font-sans"
                title="Claim free testnet USDC from Circle for Base Sepolia"
              >
                <RuneIcon name="nature-cloud-rain" className="h-3 w-3 shrink-0" />
                <span>Faucet</span>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[#d2d6df] dark:border-[#222222] bg-[#f8f9fb] dark:bg-[#080808] px-3 py-2.5 font-mono focus-within:border-foreground/60 transition-colors">
          <input
            type="number"
            value={collateralInput}
            onChange={(e) => setCollateralInput(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-foreground outline-none text-sm font-bold tracking-tight"
          />
          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            <span className="font-semibold text-xs text-foreground-muted">USDC</span>
          </div>
        </div>

        {/* Minimal Percentage Slider & Snap Points */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                if (availableBalanceUsd > 0) {
                  const val = (availableBalanceUsd * pct) / 100;
                  const formatted = val % 1 === 0 ? String(val) : val.toFixed(2);
                  setCollateralInput(formatted);
                }
              }}
              className="flex-1 py-1 rounded bg-[#f0f2f6] hover:bg-[#e4e7ee] dark:bg-[#121212] dark:hover:bg-[#181818] border border-[#d2d6df] dark:border-[#222222] text-[10px] font-mono text-foreground-muted hover:text-foreground transition-colors cursor-pointer text-center"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* ─── 5. Sleek Inline Leverage Selector ─── */}
      <div className="flex flex-col gap-1.5 mt-2.5">
        <div className="flex justify-between items-center text-[11px] font-mono text-foreground-muted">
          <span>Leverage</span>
          <span className="font-bold text-foreground">{leverage}x</span>
        </div>

        <div className="grid grid-cols-5 gap-1 font-mono">
          {[1, 2, 3, 5, 10].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLeverage(lvl)}
              className={cn(
                "py-1 rounded text-[11px] font-medium transition-all cursor-pointer border text-center",
                leverage === lvl
                  ? "border-foreground bg-white dark:bg-[#1a1a1a] dark:border-[#333333] text-foreground font-bold shadow-xs"
                  : "border-[#d2d6df] dark:border-[#222222] bg-[#f0f2f6] dark:bg-[#121212] hover:bg-[#e4e7ee] dark:hover:bg-[#181818] text-foreground-muted"
              )}
            >
              {lvl}x
            </button>
          ))}
        </div>
      </div>

      {/* ─── 6. Execution Options: TP/SL & Reduce-Only ─── */}
      <div className="flex items-center justify-between text-[11px] font-mono text-foreground-muted mt-3 pt-2 border-t border-[#e2e5eb] dark:border-[#1e1e1e]">
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-foreground select-none">
          <input
            type="checkbox"
            checked={enableTpSl}
            onChange={(e) => setEnableTpSl(e.target.checked)}
            className="rounded border-[#d2d6df] dark:border-[#222222] accent-foreground h-3.5 w-3.5"
          />
          <span>TP / SL</span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer hover:text-foreground select-none">
          <input
            type="checkbox"
            checked={reduceOnly}
            onChange={(e) => setReduceOnly(e.target.checked)}
            className="rounded border-[#d2d6df] dark:border-[#222222] accent-foreground h-3.5 w-3.5"
          />
          <span>Reduce Only</span>
        </label>

        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1 text-[10px] text-foreground-muted hover:text-foreground cursor-pointer"
        >
          <RuneIcon name="tools-settings-2" className="h-3 w-3" />
          <span>{slippageTolerance}%</span>
        </button>
      </div>

      {/* Slippage Settings Pop-down */}
      {showSettings && (
        <div className="flex items-center justify-between rounded-lg bg-[#f8f9fb] dark:bg-[#080808] border border-[#d2d6df] dark:border-[#1e1e1e] p-2 mt-1.5 text-[10px] font-mono animate-in fade-in-0 duration-150">
          <span className="text-foreground-muted">Slippage Tolerance</span>
          <div className="flex gap-1">
            {[0.1, 0.5, 1.0].map((slip) => (
              <button
                key={slip}
                type="button"
                onClick={() => setSlippageTolerance(slip)}
                className={cn(
                  "px-2 py-0.5 rounded border transition-colors cursor-pointer",
                  slippageTolerance === slip
                    ? "border-foreground/50 bg-[#e4e7ee] dark:bg-[#1a1a1a] text-foreground font-bold"
                    : "border-[#d2d6df] dark:border-[#222222] hover:bg-[#e4e7ee] dark:hover:bg-[#141414] text-foreground-muted"
                )}
              >
                {slip}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TP / SL Unfolded Inputs */}
      {enableTpSl && (
        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-[#e2e5eb] dark:border-[#1e1e1e] animate-in fade-in-0 duration-150">
          {/* Take Profit */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-positive font-semibold">Take Profit</span>
              {tpNumber > 0 && (
                <span className="text-positive">
                  Est: +{formatUsd(projectedTp.pnlUsd)} ({formatSignedPercent(projectedTp.pnlPercent)})
                </span>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#d2d6df] dark:border-[#222222] bg-[#f8f9fb] dark:bg-[#080808] px-2.5 py-1.5 font-mono">
              <input
                type="number"
                value={takeProfitInput}
                onChange={(e) => setTakeProfitInput(e.target.value)}
                placeholder={isLong ? (effectivePrice * 1.05).toFixed(2) : (effectivePrice * 0.95).toFixed(2)}
                className="w-full bg-transparent text-foreground outline-none text-xs"
              />
              <span className="text-[10px] text-foreground-muted">USD</span>
            </div>
          </div>

          {/* Stop Loss */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-negative font-semibold">Stop Loss</span>
              {slNumber > 0 && (
                <span className="text-negative">
                  Est: {formatUsd(projectedSl.pnlUsd)} ({formatSignedPercent(projectedSl.pnlPercent)})
                </span>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#d2d6df] dark:border-[#222222] bg-[#f8f9fb] dark:bg-[#080808] px-2.5 py-1.5 font-mono">
              <input
                type="number"
                value={stopLossInput}
                onChange={(e) => setStopLossInput(e.target.value)}
                placeholder={isLong ? (effectivePrice * 0.97).toFixed(2) : (effectivePrice * 1.03).toFixed(2)}
                className="w-full bg-transparent text-foreground outline-none text-xs"
              />
              <span className="text-[10px] text-foreground-muted">USD</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. Integrated AI Co-Pilot (Clean Institutional Layout) ─── */}
      {useAgentDelegation && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#d2d6df] dark:border-[#1e1e1e] bg-[#f8f9fb] dark:bg-[#080808] p-2.5 mt-2 animate-in fade-in-0 duration-150 text-[11px] font-mono">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-sans font-bold text-xs text-foreground">
              <RuneIcon name="tools-sparkles" className="h-3.5 w-3.5 text-accent" />
              <span>AI Execution Strategy</span>
            </div>
            <span
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                currentStrategy.signal.includes("BULL")
                  ? "bg-positive/15 text-positive border border-positive/30"
                  : currentStrategy.signal.includes("BEAR")
                  ? "bg-negative/15 text-negative border border-negative/30"
                  : "bg-[#e5e8ee] dark:bg-[#121212] text-foreground-muted border border-[#d2d6df] dark:border-[#222222]"
              )}
            >
              {currentStrategy.signal.replace("_", " ")}
            </span>
          </div>

          {/* Model Selector */}
          <div className="flex flex-col gap-1">
            <select
              value={selectedAgentStrategy}
              onChange={(e) => setSelectedAgentStrategy(e.target.value)}
              className="w-full rounded-md border border-[#d2d6df] dark:border-[#222222] bg-white dark:bg-[#0a0a0a] px-2.5 py-1.5 text-xs text-foreground font-medium outline-none cursor-pointer hover:border-foreground/40 transition-colors"
            >
              {AI_STRATEGIES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clean Metric Pills (No Duplicates, No Wrapping) */}
          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center">
            <div className="rounded bg-white dark:bg-[#0a0a0a] border border-[#d2d6df] dark:border-[#222222] py-1 px-1.5 flex flex-col">
              <span className="text-foreground-muted text-[9px]">Win Rate</span>
              <span className="font-bold text-foreground">{currentStrategy.confidence}%</span>
            </div>
            <div className="rounded bg-white dark:bg-[#0a0a0a] border border-[#d2d6df] dark:border-[#222222] py-1 px-1.5 flex flex-col">
              <span className="text-foreground-muted text-[9px]">Sharpe</span>
              <span className="font-bold text-foreground">{currentStrategy.sharpe}</span>
            </div>
            <div className="rounded bg-white dark:bg-[#0a0a0a] border border-[#d2d6df] dark:border-[#222222] py-1 px-1.5 flex flex-col">
              <span className="text-foreground-muted text-[9px]">Custody</span>
              <span className="font-bold text-positive">Non-Custodial</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1.5 border-t border-[#e2e5eb] dark:border-[#1e1e1e] text-[10px]">
            <span className="text-foreground-muted truncate text-[10px] pr-2">
              {currentStrategy.tagline}
            </span>
            <button
              type="button"
              onClick={handleApplyAiLevels}
              className="px-2 py-1 rounded bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent font-semibold text-[10px] transition-colors cursor-pointer shrink-0 flex items-center gap-1"
            >
              <RuneIcon name="tools-sparkles" className="h-2.5 w-2.5 text-accent" />
              <span>Auto TP/SL</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── 8. Primary Execution Action Button (Lighter-Style) ─── */}
      <div className="mt-2.5">
        {!isWalletConnected ? (
          <button
            type="button"
            onClick={onConnectWallet}
            className="w-full py-2.5 px-4 rounded-xl bg-[#f0f2f6] hover:bg-[#e4e7ee] dark:bg-[#121212] dark:hover:bg-[#1a1a1a] border border-[#d2d6df] dark:border-[#222222] text-foreground font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Connect Wallet to Trade</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isSubmitting || collateralNumber <= 0}
            onClick={onOpenPosition}
            className={cn(
              "w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-white",
              isLong
                ? "bg-[#0ecb81] hover:bg-[#0ecb81]/90"
                : "bg-[#f6465d] hover:bg-[#f6465d]/90"
            )}
          >
            {isSubmitting ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>{submitStatusText || "Submitting..."}</span>
              </>
            ) : (
              <span>
                {useAgentDelegation ? "Delegate & " : ""}
                {isLong ? "Buy / Long" : "Sell / Short"}{" "}
                {selectedMarket.symbol.replace("-PERP", "")}
                {positionSizeUsd > 0 ? ` (${formatUsd(positionSizeUsd)})` : ""}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ─── 9. Key Specs Summary (Quiet, Institutional Breakdown) ─── */}
      <div className="mt-3 flex flex-col gap-1 pt-2.5 border-t border-[#e2e5eb] dark:border-[#1e1e1e] font-mono text-[11px] text-foreground-muted">
        <div className="flex justify-between">
          <span>Order Size</span>
          <span className="text-foreground font-medium">
            {positionSizeUsd > 0 ? formatUsd(positionSizeUsd) : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Est. Liq. Price</span>
          <span className="text-foreground font-medium">
            {collateralNumber > 0 ? formatPrice(estimatedLiqPrice) : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Position Margin</span>
          <span className="text-foreground font-medium">
            {collateralNumber > 0 ? formatUsd(collateralNumber) : "$0.00"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Slippage</span>
          <span className="text-foreground font-medium">
            Est: 0.05% | Max: {slippageTolerance}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Trading Fee</span>
          <span className="text-foreground font-medium">
            {collateralNumber > 0 ? formatUsd(tradingFeeUsd) : "0.05%"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default OrderFormPanel;
