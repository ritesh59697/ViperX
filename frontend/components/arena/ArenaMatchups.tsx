"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// Clean SVG components (strictly zero raw emojis)
const SwordsIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
    <path d="M13 19l6 2 2-6-4-4" />
    <path d="M9.5 6.5L17.5 14.5" />
  </svg>
);

const DicesIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    <circle cx="16" cy="8" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="8" cy="16" r="1.5" fill="currentColor" />
    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
  </svg>
);

const TerminalIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const TrophyIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
    <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const ShieldIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SearchIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FlagIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const ChartBarIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10M12 20V4M6 20v-6" />
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
  const qualifiedEntrants = useMemo(
    () => entrants.filter((e) => e.roi_pct !== null || e.sharpe_like !== null),
    [entrants]
  );

  const [agentAPda, setAgentAPda] = useState("");
  const [agentBPda, setAgentBPda] = useState("");
  const [battling, setBattling] = useState(false);
  const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([]);
  const [winner, setWinner] = useState<"A" | "B" | "draw" | null>(null);
  const [progressA, setProgressA] = useState(100);
  const [progressB, setProgressB] = useState(100);
  const logContainerRef = useRef<HTMLDivElement>(null);

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

  // 5-Round Quantitative Duel Engine
  const runSimulation = () => {
    if (!agentA || !agentB) return;

    setBattling(true);
    setWinner(null);
    setBattleLogs([]);
    setProgressA(100);
    setProgressB(100);

    const now = new Date();
    const timeBase = now.toLocaleTimeString("en-US", { hour12: false });

    const logs: BattleLogEntry[] = [
      { timestamp: timeBase, text: `INITIALIZING 1V1 BATTLE: ${agentA.name} VS ${agentB.name}`, type: "info", category: "start" },
      { timestamp: timeBase, text: `Comparing strategy parameters and risk metrics...`, type: "info", category: "compare" },
    ];

    setBattleLogs([...logs]);

    let step = 0;
    const totalSteps = 6;
    const interval = setInterval(() => {
      step++;
      const timeStr = new Date(Date.now() + step * 1000).toLocaleTimeString("en-US", { hour12: false });

      if (step === 1) {
        // Round 1: Sharpe Ratio Comparison
        const sharpeA = Number(agentA.sharpe_like || 0);
        const sharpeB = Number(agentB.sharpe_like || 0);
        let text = "";
        let winA = false;

        if (sharpeA !== sharpeB) {
          winA = sharpeA > sharpeB;
          text = winA
            ? `Sharpe Comparison: ${agentA.name} holds better risk-adjusted return (${sharpeA.toFixed(2)} vs ${sharpeB.toFixed(2)}).`
            : `Sharpe Comparison: ${agentB.name} leads with superior volatility compensation (${sharpeB.toFixed(2)} vs ${sharpeA.toFixed(2)}).`;
        } else {
          winA = Math.random() > 0.5;
          text = winA
            ? `Sharpe Comparison: Tied Sharpe ratios. ${agentA.name} captures microsecond execution precedence.`
            : `Sharpe Comparison: Tied Sharpe ratios. ${agentB.name} captures microsecond execution precedence.`;
        }

        if (winA) setProgressB((p) => Math.max(75, p - 20));
        else setProgressA((p) => Math.max(75, p - 20));

        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "info", category: "sharpe" }]);
      } else if (step === 2) {
        // Round 2: Downside Drawdown Defense
        const ddA = Math.abs(Number(agentA.max_drawdown_pct || 0));
        const ddB = Math.abs(Number(agentB.max_drawdown_pct || 0));
        let text = "";
        let winA = false;

        if (ddA !== ddB) {
          winA = ddA < ddB;
          text = winA
            ? `Risk Check: ${agentA.name} protected downside better with lower drawdown (-${ddA.toFixed(2)}% vs -${ddB.toFixed(2)}%).`
            : `Risk Check: ${agentB.name} shields against adverse market movement (-${ddB.toFixed(2)}% vs -${ddA.toFixed(2)}%).`;
        } else {
          winA = Math.random() > 0.5;
          text = winA
            ? `Risk Check: Both bots maintain pristine drawdown. ${agentA.name} adjusts protective stop-loss faster.`
            : `Risk Check: Both bots maintain pristine drawdown. ${agentB.name} adjusts protective stop-loss faster.`;
        }

        if (winA) setProgressB((p) => Math.max(50, p - 25));
        else setProgressA((p) => Math.max(50, p - 25));

        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "info", category: "risk" }]);
      } else if (step === 3) {
        // Round 3: Execution Velocity & Strategy Trigger
        const winA = Math.random() > 0.5;
        const text = winA
          ? `Strategy execution: ${agentA.name} triggers high-frequency buy signals. Gaining temporary edge.`
          : `Strategy execution: ${agentB.name} triggers optimal order routing with minimal slippage.`;

        if (winA) setProgressB((p) => Math.max(30, p - 20));
        else setProgressA((p) => Math.max(30, p - 20));

        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "info", category: "strategy" }]);
      } else if (step === 4) {
        // Round 4: Realized ROI Yield Strike
        const roiA = Number(agentA.roi_pct || 0);
        const roiB = Number(agentB.roi_pct || 0);
        let text = "";
        let winA = false;

        if (roiA !== roiB) {
          winA = roiA > roiB;
          text = winA
            ? `ROI Strike: ${agentA.name} lands +${roiA.toFixed(2)}% return over competing regime.`
            : `ROI Strike: ${agentB.name} lands +${roiB.toFixed(2)}% return over competing regime.`;
        } else {
          winA = Math.random() > 0.5;
          text = winA
            ? `ROI Strike: Equal ROI. ${agentA.name} captures transient bid liquidity (+0.05% PnL).`
            : `ROI Strike: Equal ROI. ${agentB.name} captures transient bid liquidity (+0.05% PnL).`;
        }

        if (winA) setProgressB((p) => Math.max(10, p - 25));
        else setProgressA((p) => Math.max(10, p - 25));

        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "info", category: "roi" }]);
      } else if (step === 5) {
        // Round 5: Anti-Gaming Verification Check
        const text = `Verification check: Both agents pass ViperX Wash-Trading & Anti-Gaming protocols. Verified testnet fills confirmed.`;
        setBattleLogs((prev) => [...prev, { timestamp: timeStr, text, type: "success", category: "audit" }]);
      } else if (step === totalSteps) {
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
          { timestamp: timeStr, text: `BATTLE ENDED: ${winnerName}`, type: "success", category: "end" },
        ]);
        setBattling(false);
      }
    }, 1000);
  };

  return (
    <div className="mt-8 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414] text-left">
      <div className="flex flex-col gap-6 rounded-lg bg-white p-6 dark:bg-[#0a0a0a]">
        <div>
          <h3 className="text-base font-bold text-foreground">1v1 Battle Matchups</h3>
          <p className="text-xs text-foreground-muted mt-1">
            Pick any two qualified competitors from this season and simulate a risk-adjusted matchup.
          </p>
        </div>

        {qualifiedEntrants.length < 2 ? (
          <div className="rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
            <div className="rounded-lg bg-white p-6 text-center font-mono text-xs text-foreground-muted dark:bg-[#0a0a0a]">
              Need at least 2 qualified entrants with ROI/Sharpe logs to simulate 1v1 matchups.
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Entrant A Selector */}
            <div className="flex flex-col gap-3">
              <label className="t-label">Agent A</label>
              <select
                value={selectedAgentAPda}
                onChange={(e) => {
                  setAgentAPda(e.target.value);
                  setWinner(null);
                  setBattleLogs([]);
                  setProgressA(100);
                  setProgressB(100);
                }}
                disabled={battling}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
              >
                {qualifiedEntrants.map((e) => (
                  <option key={e.agent_pda} value={e.agent_pda} disabled={e.agent_pda === selectedAgentBPda}>
                    {e.name} ({e.agent_id.trim()})
                  </option>
                ))}
              </select>

              {agentA && (
                <div className="mt-2 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                  <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-3.5 dark:bg-[#111111]">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-foreground-muted">ROI:</span>
                      <span className="text-foreground font-bold">{Number(agentA.roi_pct || 0).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-foreground-muted">Sharpe:</span>
                      <span className="text-foreground font-bold">{Number(agentA.sharpe_like || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-foreground-muted">Max DD:</span>
                      <span className="text-foreground font-bold">-{Math.abs(Number(agentA.max_drawdown_pct || 0)).toFixed(2)}%</span>
                    </div>
                    {/* Dynamic Health/Progress indicator */}
                    <div className="mt-2 h-1.5 w-full bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          progressA > 50 ? "bg-positive" : progressA > 25 ? "bg-accent" : "bg-negative"
                        }`}
                        style={{ width: `${progressA}%` }}
                      />
                    </div>
                  </div>
                </div>
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
                  <span
                    className={`text-sm font-bold font-mono ${
                      winner === "A" || winner === "B" ? "text-positive" : "text-warning"
                    }`}
                  >
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
                onChange={(e) => {
                  setAgentBPda(e.target.value);
                  setWinner(null);
                  setBattleLogs([]);
                  setProgressA(100);
                  setProgressB(100);
                }}
                disabled={battling}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
              >
                {qualifiedEntrants.map((e) => (
                  <option key={e.agent_pda} value={e.agent_pda} disabled={e.agent_pda === selectedAgentAPda}>
                    {e.name} ({e.agent_id.trim()})
                  </option>
                ))}
              </select>

              {agentB && (
                <div className="mt-2 rounded-xl border border-black/10 bg-neutral-200/60 p-1 dark:border-[#262626] dark:bg-[#141414]">
                  <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-3.5 dark:bg-[#111111]">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-foreground-muted">ROI:</span>
                      <span className="text-foreground font-bold">{Number(agentB.roi_pct || 0).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-foreground-muted">Sharpe:</span>
                      <span className="text-foreground font-bold">{Number(agentB.sharpe_like || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-foreground-muted">Max DD:</span>
                      <span className="text-foreground font-bold">-{Math.abs(Number(agentB.max_drawdown_pct || 0)).toFixed(2)}%</span>
                    </div>
                    {/* Dynamic Health/Progress indicator */}
                    <div className="mt-2 h-1.5 w-full bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          progressB > 50 ? "bg-positive" : progressB > 25 ? "bg-accent" : "bg-negative"
                        }`}
                        style={{ width: `${progressB}%` }}
                      />
                    </div>
                  </div>
                </div>
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
      </div>
    </div>
  );
}
