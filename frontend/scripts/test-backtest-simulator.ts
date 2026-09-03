import { runBacktest, generateRegimeData } from "../lib/backtest/simulator";

function testSimulator() {
  console.log("==================================================");
  console.log("  Testing Backtest Simulator Logic Programmatically ");
  console.log("==================================================");

  const regimes = ["bull", "bear", "range", "crash"] as const;
  const strategies = ["momentum", "grid", "mean_reversion"] as const;

  for (const regime of regimes) {
    const ticks = generateRegimeData(regime, 150, 200);
    console.log(`Generated ${ticks.length} ticks for regime: ${regime.toUpperCase()}`);
    console.log(`- Start price: $${ticks[0].price}`);
    console.log(`- End price: $${ticks[ticks.length - 1].price}`);

    for (const strategy of strategies) {
      const result = runBacktest({
        strategyType: strategy,
        startingCapital: 1000,
        marketSymbol: "SOL-PERP",
        regime,
        sizeUsd: 100,
        thresholdBps: 50,
        windowSize: 10,
        gridSpacingBps: 100,
        rsiLowerThreshold: 30,
        rsiUpperThreshold: 70,
      }, ticks);

      console.log(`\n  Strategy: ${strategy.toUpperCase()}`);
      console.log(`  - ROI: ${result.metrics.roi}%`);
      console.log(`  - Sharpe Ratio: ${result.metrics.sharpe}`);
      console.log(`  - Max Drawdown: ${result.metrics.maxDrawdown}%`);
      console.log(`  - Win Rate: ${result.metrics.winRate}%`);
      console.log(`  - Total Trades: ${result.metrics.totalTrades}`);
      console.log(`  - Final Balance: $${result.metrics.finalBalance}`);
      
      // Basic assertions
      if (isNaN(result.metrics.roi) || isNaN(result.metrics.sharpe) || isNaN(result.metrics.maxDrawdown)) {
        throw new Error(`Invalid metric calculated for ${strategy} on ${regime}`);
      }
    }
    console.log("--------------------------------------------------");
  }

  console.log("All simulator backtest runs completed successfully and calculated valid metrics!");
}

testSimulator();
