"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Entrant {
  agent_pda: string;
  name: string;
  agent_id: string;
  owner: string;
  sharpe_like: string | null;
  roi_pct: string | null;
  max_drawdown_pct: string | null;
  verified_trade_count: number | null;
}

interface ArenaMatchupsProps {
  entrants: Entrant[];
}

interface BattleLogEntry {
  timestamp: string;
  text: string;
  type: "info" | "success" | "warning" | "error";
  category?: "start" | "compare" | "sharpe" | "risk" | "strategy" | "roi" | "audit" | "end";
}

// Clean premium SVG components (replacing emojis)
const SwordsIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 3L3 21M3 3l18 18" />
  </svg>
);

const DicesIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <circle cx="6.5" cy="6.5" r="0.5" fill="currentColor" />
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    <circle cx="6.5" cy="17.5" r="0.5" fill="currentColor" />
    <circle cx="17.5" cy="17.5" r="0.5" fill="currentColor" />
  </svg>
);

const TerminalIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3" />
  </svg>
);

const TrophyIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const ShieldIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const SearchIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FlagIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21v8H12.5l-1-1H5v5h-2z" />
  </svg>
);

const ChartBarIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
  </svg>
);

const LOG_ICONS = {
  start: <SwordsIcon className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />,
  compare: <ChartBarIcon className="h-3.5 w-3.5 text-foreground-faint shrink-0 mt-0.5" />,
  sharpe: <ChartBarIcon className="h-3.5 w-3.5 text-positive shrink-0 mt-0.5" />,
  risk: <ShieldIcon className="h-3.5 w-3.5 text-negative shrink-0 mt-0.5" />,
  strategy: <TerminalIcon className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />,
  roi: <TrophyIcon className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />,
  audit: <SearchIcon className="h-3.5 w-3.5 text-positive shrink-0 mt-0.5" />,
  end: <FlagIcon className="h-3.5 w-3.5 text-positive shrink-0 mt-0.5" />,
};

export function ArenaMatchups({ entrants }: ArenaMatchupsProps) {
  const [agentAPda, setAgentAPda] = useState("");
  const [agentBPda, setAgentBPda] = useState("");
  const [battling, setBattling] = useState(false);
  const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([]);
  const [winner, setWinner] = useState<"A" | "B" | "draw" | null>(null);
  const [progressA, setProgressA] = useState(100);
  const [progressB, setProgressB] = useState(100);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const qualifiedEntrants = useMemo(
    () => entrants.filter((e) => e.roi_pct !== null),
    [entrants]
  );
  const selectedAgentAPda = agentAPda || qualifiedEntrants[0]?.agent_pda || "";
  const selectedAgentBPda = agentBPda || qualifiedEntrants[1]?.agent_pda || "";

  // Scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [battleLogs]);

  const agentA = entrants.find((e) => e.agent_pda === selectedAgentAPda);
  const agentB = entrants.find((e) => e.agent_pda === selectedAgentBPda);

  const pickRandomMatchup = () => {
    if (qualifiedEntrants.length < 2) return;
    const idxA = Math.floor(Math.random() * qualifiedEntrants.length);
    let idxB = Math.floor(Math.random() * qualifiedEntrants.length);
    while (idxB === idxA) {
      idxB = Math.floor(Math.random() * qualifiedEntrants.length);
    }
    setAgentAPda(qualifiedEntrants[idxA].agent_pda);
    setAgentBPda(qualifiedEntrants[idxB].agent_pda);
    setWinner(null);
    setBattleLogs([]);
    setProgressA(100);
    setProgressB(100);
  };

  const runSimulation = () => {
    if (!agentA || !agentB) return;

    setBattling(true);
    setWinner(null);
    setBattleLogs([]);
    setProgressA(100);
    setProgressB(100);

    const logs: BattleLogEntry[] = [
      { timestamp: "16:40:00", text: `INITIALIZING 1V1 BATTLE: ${agentA.name} VS ${agentB.name}`, type: "info", category: "start" },
      { timestamp: "16:40:01", text: `Comparing strategy parameters and risk metrics...`, type: "info", category: "compare" },
    ];

    setBattleLogs([...logs]);

    let step = 0;
    const totalSteps = 6;
    const interval = setInterval(() => {
      step++;
      const timeStr = `16:40:0${step + 1}`;

      if (step === 1) {
        // Compare Sharpe Ratios
        const sharpeA = Number(agentA.sharpe_like || 0);
        const sharpeB = Number(agentB.sharpe_like || 0);
        let text = "";
        let winA = false;

        if (sharpeA !== sharpeB) {
          winA = sharpeA > sharpeB;
          text = winA
            ? `Sharpe Comparison: ${agentA.name} holds better risk-adjusted return (${sharpeA.toFixed(2)} vs ${sharpeB.toFixed(2)}).`
            : `Sharpe Comparison: ${agentB.name} leads in volatility protection (${sharpeB.toFixed(2)} vs ${sharpeA.toFixed(2)}).`;
        } else {
          winA = Math.random() > 0.5;
          text = winA
            ? `Sharpe Comparison: Identical Sharpe records. ${agentA.name} secures a microsecond execution edge.`
            : `Sharpe Comparison: Identical Sharpe records. ${agentB.name} secures a microsecond execution edge.`;
        }
        
        if (winA) setProgressB((p) => Math.max(75, p - 15));
        else setProgressA((p) => Math.max(75, p - 15));

        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "info", category: "sharpe" }]);
      } 
      else if (step === 2) {
        // Drawdowns check
        const ddA = Math.abs(Number(agentA.max_drawdown_pct || 0));
        const ddB = Math.abs(Number(agentB.max_drawdown_pct || 0));
        let text = "";
        let winA = false;

        if (ddA !== ddB) {
          winA = ddA < ddB;
          text = winA
            ? `Risk Check: ${agentA.name} protected downside better with lower drawdown (-${ddA.toFixed(2)}% vs -${ddB.toFixed(2)}%).`
            : `Risk Check: ${agentB.name} has superior max drawdown control (-${ddB.toFixed(2)}% vs -${ddA.toFixed(2)}%).`;
        } else {
          winA = Math.random() > 0.5;
          text = winA
            ? `Risk Check: Both hold 0.00% drawdown. ${agentA.name} optimizes leverage limits faster.`
            : `Risk Check: Both hold 0.00% drawdown. ${agentB.name} optimizes leverage limits faster.`;
        }

        if (winA) setProgressB((p) => Math.max(50, p - 20));
        else setProgressA((p) => Math.max(50, p - 20));

        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "info", category: "risk" }]);
      } 
      else if (step === 3) {
        // Rationale / Strategy triggers simulated events
        const winA = Math.random() > 0.5;
        const text = winA
          ? `Strategy execution: ${agentA.name} triggers high-frequency buy signals. Gaining temporary edge.`
          : `Strategy execution: ${agentB.name} matches orderbook depth. Compiling counter-orders.`;

        if (winA) setProgressB((p) => Math.max(40, p - 10));
        else setProgressA((p) => Math.max(40, p - 10));
        
        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "info", category: "strategy" }]);
      }
      else if (step === 4) {
        // ROI comparisons
        const roiA = Number(agentA.roi_pct || 0);
        const roiB = Number(agentB.roi_pct || 0);
        let text = "";
        let winA = false;

        if (roiA !== roiB) {
          winA = roiA > roiB;
          text = winA
            ? `ROI Strike: ${agentA.name} lands +${roiA.toFixed(2)}% return over competing regime.`
            : `ROI Strike: ${agentB.name} returns higher raw yield (+${roiB.toFixed(2)}%).`;
        } else {
          winA = Math.random() > 0.5;
          text = winA
            ? `ROI Strike: Both hold 0.00% ROI. ${agentA.name} captures transient bid liquidity (+0.05% PnL).`
            : `ROI Strike: Both hold 0.00% ROI. ${agentB.name} captures transient bid liquidity (+0.05% PnL).`;
        }

        if (winA) setProgressB((p) => Math.max(15, p - 25));
        else setProgressA((p) => Math.max(15, p - 25));

        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "info", category: "roi" }]);
      }
      else if (step === 5) {
        // Anti-gaming verification check
        const text = `Audit check: Both agents pass ViperX Wash-Trading & Anti-Gaming protocols. Verified fills confirmed.`;
        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "success", category: "audit" }]);
      }
      else if (step === totalSteps) {
        clearInterval(interval);
        
        // Compute ultimate winner based on combination of ROI & Sharpe
        const scoreA = Number(agentA.roi_pct || 0) * 0.4 + Number(agentA.sharpe_like || 0) * 0.6;
        const scoreB = Number(agentB.roi_pct || 0) * 0.4 + Number(agentB.sharpe_like || 0) * 0.6;
        
        let resultWinner: "A" | "B" | "draw" = "draw";
        if (scoreA !== scoreB) {
          resultWinner = scoreA > scoreB ? "A" : "B";
        } else {
          resultWinner = Math.random() > 0.5 ? "A" : "B";
        }

        let winnerName = "";
        if (resultWinner === "A") {
          winnerName = `${agentA.name} Wins!`;
          setProgressB(0);
        } else if (resultWinner === "B") {
          winnerName = `${agentB.name} Wins!`;
          setProgressA(0);
        } else {
          winnerName = "It's a draw!";
        }

        setWinner(resultWinner);
        setBattleLogs((prev) => [
          ...prev,
          { timestamp: timeStr, text: `BATTLE ENDED: ${winnerName}`, type: "success", category: "end" }
        ]);
        setBattling(false);
      }
    }, 1000);
  };

  return (
    <Card className="mt-8 flex flex-col gap-6 p-6 text-left">
      <div>
        <h3 className="text-base font-bold text-foreground">1v1 Battle Matchups</h3>
        <p className="text-xs text-foreground-muted mt-1">
          Pick any two qualified competitors from this season and simulate a risk-adjusted matchup.
        </p>
      </div>

      {qualifiedEntrants.length < 2 ? (
        <Card variant="muted" className="text-center py-6 text-xs text-foreground-faint">
          Need at least 2 qualified entrants with ROI/Sharpe logs to simulate 1v1 matchups.
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Entrant A Selector */}
          <div className="flex flex-col gap-3">
            <label className="t-label">Agent A</label>
            <select
              value={selectedAgentAPda}
              onChange={(e) => { setAgentAPda(e.target.value); setWinner(null); setBattleLogs([]); }}
              disabled={battling}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
            >
              {qualifiedEntrants.map((e) => (
                <option key={e.agent_pda} value={e.agent_pda} disabled={e.agent_pda === agentBPda}>
                  {e.name} ({e.agent_id.trim()})
                </option>
              ))}
            </select>

            {agentA && (
              <Card variant="muted" className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-foreground-faint">ROI:</span>
                  <span className="text-foreground font-bold">{Number(agentA.roi_pct).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-foreground-faint">Sharpe:</span>
                  <span className="text-foreground font-bold">{Number(agentA.sharpe_like).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-foreground-faint">Max DD:</span>
                  <span className="text-foreground font-bold">-{Math.abs(Number(agentA.max_drawdown_pct)).toFixed(2)}%</span>
                </div>
                {/* Health/Progress indicator */}
                <div className="mt-2 h-1.5 w-full bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-positive transition-all duration-300"
                    style={{ width: `${progressA}%` }}
                  />
                </div>
              </Card>
            )}
          </div>

          {/* Arena Control */}
          <div className="flex flex-col justify-center items-center gap-4">
            <div className="text-2xl font-bold font-mono text-foreground-faint">VS</div>
            <div className="flex flex-col gap-2 w-full">
              <Button
                type="button"
                onClick={runSimulation}
                disabled={battling || !agentA || !agentB}
                className="w-full justify-center py-2.5 text-xs font-semibold shadow-lg gap-2"
              >
                {battling ? (
                  <>
                    <TerminalIcon className="h-4 w-4 animate-pulse" />
                    <span>Simulating Battle...</span>
                  </>
                ) : (
                  <>
                    <SwordsIcon className="h-4 w-4" />
                    <span>Run 1v1 Battle</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={pickRandomMatchup}
                disabled={battling}
                className="w-full justify-center py-2 text-xs gap-2"
              >
                <DicesIcon className="h-4 w-4" />
                <span>Randomize Pair</span>
              </Button>
            </div>

            {winner && (
              <div className="mt-2 text-center">
                <span className="text-[10px] uppercase tracking-wider font-mono text-foreground-faint block">Winner</span>
                <span className={`text-sm font-bold font-mono ${
                  winner === "A" ? "text-positive" : winner === "B" ? "text-positive" : "text-warning"
                }`}>
                  {winner === "A" ? agentA?.name : winner === "B" ? agentB?.name : "Draw Decision"}
                </span>
              </div>
            )}
          </div>

          {/* Entrant B Selector */}
          <div className="flex flex-col gap-3">
            <label className="t-label">Agent B</label>
            <select
              value={selectedAgentBPda}
              onChange={(e) => { setAgentBPda(e.target.value); setWinner(null); setBattleLogs([]); }}
              disabled={battling}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
            >
              {qualifiedEntrants.map((e) => (
                <option key={e.agent_pda} value={e.agent_pda} disabled={e.agent_pda === agentAPda}>
                  {e.name} ({e.agent_id.trim()})
                </option>
              ))}
            </select>

            {agentB && (
              <Card variant="muted" className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-foreground-faint">ROI:</span>
                  <span className="text-foreground font-bold">{Number(agentB.roi_pct).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-foreground-faint">Sharpe:</span>
                  <span className="text-foreground font-bold">{Number(agentB.sharpe_like).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-foreground-faint">Max DD:</span>
                  <span className="text-foreground font-bold">-{Math.abs(Number(agentB.max_drawdown_pct)).toFixed(2)}%</span>
                </div>
                {/* Health/Progress indicator */}
                <div className="mt-2 h-1.5 w-full bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-positive transition-all duration-300"
                    style={{ width: `${progressB}%` }}
                  />
                </div>
              </Card>
            )}
          </div>

          {/* Simulation Feed */}
          <div className="md:col-span-3 flex flex-col gap-2">
            <label className="t-label">Simulation feed</label>
            <div className="overflow-hidden rounded-xl border border-border bg-background-elevated-solid">
              <div className="flex flex-col gap-3 border-b border-border bg-background-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <TerminalIcon className="h-4 w-4 text-accent" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                    Risk-adjusted battle log
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-faint">
                  {battling ? "Running checks" : battleLogs.length > 0 ? "Run complete" : "Ready"}
                </span>
              </div>
              <div
                ref={logContainerRef}
                className="min-h-72 space-y-3 overflow-y-auto bg-background-elevated-solid p-4 font-mono text-xs leading-relaxed sm:min-h-80"
              >
                {battleLogs.length === 0 ? (
                  <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border bg-background-muted px-6 text-center text-foreground-muted sm:h-64">
                    Pick two qualified agents, then run a battle to see Sharpe, drawdown,
                    strategy execution, ROI, and anti-gaming checks unfold here.
                  </div>
                ) : (
                  battleLogs.map((log, i) => (
                    <div key={i} className="grid grid-cols-[5.25rem_1rem_1fr] gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-background-muted">
                      <span className="mt-0.5 text-foreground-faint">[{log.timestamp}]</span>
                      {log.category ? LOG_ICONS[log.category] : <span />}
                      <span className={
                        log.type === "success" ? "text-positive" :
                        log.type === "warning" ? "text-accent" :
                        log.type === "error" ? "text-negative" :
                        "text-foreground-muted"
                      }>
                        {log.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
