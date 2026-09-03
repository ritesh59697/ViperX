/**
 * Backtesting engine for strategy validation.
 * Runs client-side for fast, offline, interactive backtests.
 */

export interface BacktestParams {
  strategyType: "momentum" | "grid" | "mean_reversion";
  startingCapital: number;
  marketSymbol: string;
  regime: "bull" | "bear" | "range" | "crash";
  // Strategy generic knobs
  sizeUsd: number;
  // Strategy specific knobs
  thresholdBps?: number;
  windowSize?: number;
  gridSpacingBps?: number;
  rsiLowerThreshold?: number;
  rsiUpperThreshold?: number;
}

export interface PriceTick {
  price: number;
  timestamp: number;
}

export interface BacktestTrade {
  side: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  openedAt: number;
  closedAt: number;
  entryReason: string;
  exitReason: string;
}

export interface BacktestResult {
  metrics: {
    totalTrades: number;
    winRate: number;
    roi: number;
    maxDrawdown: number;
    sharpe: number;
    finalBalance: number;
  };
  trades: BacktestTrade[];
  equityCurve: { timestamp: number; equity: number; price: number }[];
}

/**
 * Generates synthetic historical price ticks based on the selected market regime.
 */
export function generateRegimeData(
  regime: "bull" | "bear" | "range" | "crash",
  startPrice = 150,
  steps = 500
): PriceTick[] {
  const data: PriceTick[] = [];
  const startTimestamp = Date.now() - steps * 60 * 60 * 1000; // 1 step = 1 hour
  let price = startPrice;

  // Set drift and volatility parameters based on regime
  let drift = 0.0;
  let volatility = 0.015;

  if (regime === "bull") {
    drift = 0.0015; // Positive drift
    volatility = 0.012;
  } else if (regime === "bear") {
    drift = -0.002; // Negative drift
    volatility = 0.02;
  }

  for (let i = 0; i < steps; i++) {
    const timestamp = startTimestamp + i * 60 * 60 * 1000;
    
    if (regime === "range") {
      // Oscillating wave with random noise
      const angle = (i / steps) * Math.PI * 12; // 6 full cycles
      const cyclePrice = startPrice + Math.sin(angle) * (startPrice * 0.12);
      const noise = (Math.random() - 0.5) * (startPrice * 0.015);
      price = cyclePrice + noise;
    } else if (regime === "crash") {
      // Steady start -> flash crash in middle -> recovery
      const mid = steps / 2;
      if (i > mid - 30 && i < mid) {
        // Crashing down
        price = price * (1 - (0.02 + Math.random() * 0.03));
      } else if (i >= mid && i < mid + 50) {
        // Bouncing back up
        price = price * (1 + (0.015 + Math.random() * 0.02));
      } else {
        // Drift sideways
        const change = price * (drift + (Math.random() - 0.5) * volatility);
        price = Math.max(price + change, 1);
      }
    } else {
      // Standard Geometric Brownian Motion for bull/bear
      const change = price * (drift + (Math.random() - 0.5) * volatility);
      price = Math.max(price + change, 1);
    }

    data.push({ price: parseFloat(price.toFixed(4)), timestamp });
  }

  return data;
}

/**
 * Calculates RSI using Simple Moving Average of gains/losses
 */
function calculateRSI(prices: number[], period: number): number {
  if (prices.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

/**
 * Executes a full backtest simulation on a historical series of price ticks.
 */
export function runBacktest(params: BacktestParams, ticks: PriceTick[]): BacktestResult {
  const {
    strategyType,
    startingCapital,
    sizeUsd,
    thresholdBps = 50,
    windowSize = 20,
    gridSpacingBps = 100,
    rsiLowerThreshold = 30,
    rsiUpperThreshold = 70,
  } = params;

  let balance = startingCapital;
  let position: "flat" | "long" | "short" = "flat";
  let entryPrice = 0;
  let entryTime = 0;
  let entryReason = "";
  
  const trades: BacktestTrade[] = [];
  const equityCurve: { timestamp: number; equity: number; price: number }[] = [];
  
  // Track parameters for strategies
  let lastTradePrice = ticks[0]?.price || 0;
  const recentPrices: number[] = [];

  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    recentPrices.push(tick.price);
    if (recentPrices.length > 100) {
      recentPrices.shift();
    }

    let decision: "none" | "open_long" | "open_short" | "close" = "none";
    let triggerReason = "";

    // 1. Evaluate Strategy Logic
    if (strategyType === "momentum") {
      if (recentPrices.length >= windowSize) {
        const startPrice = recentPrices[recentPrices.length - windowSize];
        const momentumBps = ((tick.price - startPrice) / startPrice) * 10000;

        if (position === "flat") {
          if (momentumBps >= thresholdBps) {
            decision = "open_long";
            triggerReason = `Momentum: +${momentumBps.toFixed(1)} bps >= threshold +${thresholdBps} bps`;
          } else if (momentumBps <= -thresholdBps) {
            decision = "open_short";
            triggerReason = `Momentum: ${momentumBps.toFixed(1)} bps <= -threshold -${thresholdBps} bps`;
          }
        } else {
          const shouldClose =
            (position === "long" && momentumBps <= 0) ||
            (position === "short" && momentumBps >= 0);
          if (shouldClose) {
            decision = "close";
            triggerReason = `Momentum reversed: ${momentumBps.toFixed(1)} bps (crossed 0)`;
          }
        }
      }
    } else if (strategyType === "grid") {
      const priceDiffBps = ((tick.price - lastTradePrice) / lastTradePrice) * 10000;

      if (position === "flat") {
        if (priceDiffBps <= -gridSpacingBps) {
          decision = "open_long";
          triggerReason = `Grid: Price dip of ${Math.abs(priceDiffBps).toFixed(1)} bps >= spacing ${gridSpacingBps} bps`;
        } else if (priceDiffBps >= gridSpacingBps) {
          decision = "open_short";
          triggerReason = `Grid: Price spike of +${priceDiffBps.toFixed(1)} bps >= spacing ${gridSpacingBps} bps`;
        }
      } else {
        const profitMoveBps =
          position === "long"
            ? ((tick.price - lastTradePrice) / lastTradePrice) * 10000
            : ((lastTradePrice - tick.price) / lastTradePrice) * 10000;

        if (profitMoveBps >= gridSpacingBps) {
          decision = "close";
          triggerReason = `Grid Exit: Profit target of +${profitMoveBps.toFixed(1)} bps >= spacing ${gridSpacingBps} bps`;
        }
      }
    } else if (strategyType === "mean_reversion") {
      if (recentPrices.length >= windowSize) {
        const rsi = calculateRSI(recentPrices, windowSize);

        if (position === "flat") {
          if (rsi <= rsiLowerThreshold) {
            decision = "open_long";
            triggerReason = `RSI Reversion: RSI ${rsi.toFixed(1)} <= oversold ${rsiLowerThreshold}`;
          } else if (rsi >= rsiUpperThreshold) {
            decision = "open_short";
            triggerReason = `RSI Reversion: RSI ${rsi.toFixed(1)} >= overbought ${rsiUpperThreshold}`;
          }
        } else {
          const shouldClose =
            (position === "long" && rsi >= 50) ||
            (position === "short" && rsi <= 50);
          if (shouldClose) {
            decision = "close";
            triggerReason = `RSI Reverted: RSI normalized to ${rsi.toFixed(1)} (crossed 50)`;
          }
        }
      }
    }

    // 2. Process Decisions & Account Balance
    let currentUnrealized = 0;
    if (position !== "flat") {
      const pnlPct =
        position === "long"
          ? (tick.price - entryPrice) / entryPrice
          : (entryPrice - tick.price) / entryPrice;
      currentUnrealized = sizeUsd * pnlPct;
    }

    const currentEquity = balance + currentUnrealized;
    equityCurve.push({ timestamp: tick.timestamp, equity: currentEquity, price: tick.price });

    // Handle order executions
    if (decision === "open_long" || decision === "open_short") {
      position = decision === "open_long" ? "long" : "short";
      entryPrice = tick.price;
      entryTime = tick.timestamp;
      entryReason = triggerReason;
      lastTradePrice = tick.price;
    } else if (decision === "close" && position !== "flat") {
      const pnlPct =
        position === "long"
          ? (tick.price - entryPrice) / entryPrice
          : (entryPrice - tick.price) / entryPrice;
      const realizedPnl = Number((sizeUsd * pnlPct).toFixed(2));
      
      balance += realizedPnl;
      lastTradePrice = tick.price;

      trades.push({
        side: position,
        sizeUsd,
        entryPrice,
        exitPrice: tick.price,
        realizedPnl,
        openedAt: entryTime,
        closedAt: tick.timestamp,
        entryReason,
        exitReason: triggerReason,
      });

      position = "flat";
    }
  }

  // 3. Compute Performance Metrics
  const finalBalance = equityCurve[equityCurve.length - 1]?.equity ?? startingCapital;
  const roi = ((finalBalance - startingCapital) / startingCapital) * 100;
  
  const winCount = trades.filter((t) => t.realizedPnl > 0).length;
  const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;

  // Max Drawdown calculation
  let peak = startingCapital;
  let maxDrawdown = 0;
  for (const eq of equityCurve) {
    if (eq.equity > peak) {
      peak = eq.equity;
    }
    const dd = ((peak - eq.equity) / peak) * 100;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  }

  // Sharpe Ratio (Simplified based on hourly equity return volatility)
  let sharpe = 0;
  if (equityCurve.length > 1) {
    const returns: number[] = [];
    for (let j = 1; j < equityCurve.length; j++) {
      const prev = equityCurve[j - 1].equity;
      const curr = equityCurve[j].equity;
      returns.push(prev > 0 ? (curr - prev) / prev : 0);
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const sqDiffSum = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0);
    const stdDev = Math.sqrt(sqDiffSum / (returns.length - 1));
    
    // Scale hourly return to annualized risk ratio
    // 8760 hours in a year. Annualized Sharpe = (avgHourlyReturn / stdDev) * sqrt(8760)
    if (stdDev > 0) {
      sharpe = (avgReturn / stdDev) * Math.sqrt(8760);
    }
  }

  return {
    metrics: {
      totalTrades: trades.length,
      winRate: parseFloat(winRate.toFixed(2)),
      roi: parseFloat(roi.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      sharpe: parseFloat(sharpe.toFixed(2)),
      finalBalance: parseFloat(finalBalance.toFixed(2)),
    },
    trades,
    equityCurve,
  };
}
