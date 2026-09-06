"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { PnlSnapshotRecord } from "@/lib/leaderboardApi";
import { Card } from "@/components/ui/Card";

type MetricMode = "pnl" | "roi" | "drawdown";
type TimeRange = "24h" | "7d" | "30d" | "all";

const MODES: { key: MetricMode; label: string }[] = [
  { key: "pnl", label: "Realized PnL" },
  { key: "roi", label: "ROI" },
  { key: "drawdown", label: "Max Drawdown" },
];

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "all", label: "ALL" },
];

const HEIGHT = 280;
const FALLBACK_WIDTH = 1100;
// CoinGecko style: Left is flush, Right has generous space for Y-axis numbers & pinned live pill
const PAD = { top: 22, right: 68, bottom: 28, left: 16 };

function niceTicks(min: number, max: number, count = 4): { ticks: number[]; decimals: number } {
  const span = max - min;
  if (!isFinite(span) || span <= 0) return { ticks: [min], decimals: 2 };
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;

  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  }

  let decimals = 2;
  while (decimals < 6 && ticks.some((t) => Math.abs(t - Number(t.toFixed(decimals))) > step * 1e-3)) {
    decimals++;
  }
  return { ticks, decimals };
}

function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    m[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1);
  }
  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      t[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
    }
  }
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d +=
      ` C ${(pts[i].x + h).toFixed(2)},${(pts[i].y + h * t[i]).toFixed(2)}` +
      ` ${(pts[i + 1].x - h).toFixed(2)},${(pts[i + 1].y - h * t[i + 1]).toFixed(2)}` +
      ` ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
}

export function InteractiveChart({ snapshots }: { snapshots: PnlSnapshotRecord[] }) {
  const [mode, setMode] = useState<MetricMode>("pnl");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const containerCallbackRef = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }

    containerRef.current = el;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        setWidth(Math.round(w));
      }
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) {
            setWidth(Math.round(w));
          }
        }
      });
      ro.observe(el);
      roRef.current = ro;
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const w = containerRef.current.getBoundingClientRect().width;
        if (w > 0) setWidth(Math.round(w));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (roRef.current) {
        roRef.current.disconnect();
      }
    };
  }, []);

  const chartWidth = width > 0 ? width : FALLBACK_WIDTH;

  // Filter snapshots by selected timeframe
  const filteredSnapshots = useMemo(() => {
    if (snapshots.length <= 2 || timeRange === "all") {
      return snapshots;
    }

    const latestMs = new Date(snapshots[0]?.snapshot_at || Date.now()).getTime();
    const durations = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = latestMs - durations[timeRange];

    const filtered = snapshots.filter((s) => new Date(s.snapshot_at).getTime() >= cutoff);
    // Keep at least 2 data points for rendering
    return filtered.length >= 2 ? filtered : snapshots.slice(0, Math.min(10, snapshots.length));
  }, [snapshots, timeRange]);

  const chronological = useMemo(() => [...filteredSnapshots].reverse(), [filteredSnapshots]);

  const { values, format } = useMemo(() => {
    const wrap =
      mode === "pnl"
        ? (v: string) => `$${v}`
        : (v: string) => `${v}%`;
    const key =
      mode === "pnl" ? "realized_pnl" : mode === "roi" ? "roi_pct" : "max_drawdown_pct";
    return {
      values: chronological.map((s) => Number(s[key as keyof PnlSnapshotRecord]) || 0),
      format: (v: number, decimals = 2) => wrap(v.toFixed(decimals)),
    };
  }, [chronological, mode]);

  const times = useMemo(
    () => chronological.map((s) => new Date(s.snapshot_at).getTime()),
    [chronological]
  );

  const geometry = useMemo(() => {
    if (values.length < 2 || chartWidth <= 0) return null;

    const plotW = Math.max(chartWidth - PAD.left - PAD.right, 1);
    const plotH = HEIGHT - PAD.top - PAD.bottom;

    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const pad = (dataMax - dataMin || Math.abs(dataMax) || 1) * 0.15;
    const min = dataMin - pad;
    const max = dataMax + pad;
    const range = max - min;

    const xAt = (i: number) => PAD.left + (i / (values.length - 1)) * plotW;
    const yAt = (v: number) => PAD.top + plotH - ((v - min) / range) * plotH;

    const pts = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    const line = monotonePath(pts);
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(2)},${PAD.top + plotH} L ${pts[0].x.toFixed(2)},${PAD.top + plotH} Z`;

    const tickCount = Math.max(2, Math.min(5, values.length, Math.floor(plotW / 120)));
    const timeTicks = Array.from({ length: tickCount }, (_, n) => {
      const i = Math.round((n / (tickCount - 1 || 1)) * (values.length - 1));
      return { i, x: xAt(i), t: times[i] };
    });

    const totalSpan = times[times.length - 1] - times[0];
    const { ticks, decimals } = niceTicks(min, max, 4);

    return {
      pts,
      line,
      area,
      yAt,
      plotW,
      plotH,
      timeTicks,
      spansMonths: isFinite(totalSpan) && totalSpan > 30 * 24 * 60 * 60 * 1000,
      ticks: ticks.filter((t) => t >= min && t <= max),
      tickDecimals: decimals,
      zeroY: min <= 0 && max >= 0 ? yAt(0) : null,
    };
  }, [values, times, chartWidth]);

  if (snapshots.length < 2) {
    return (
      <Card variant="muted" className="mb-8">
        Insufficient PnL snapshot history to render visual performance chart. (Requires ≥ 2 data points)
      </Card>
    );
  }

  const latestVal = values[values.length - 1];
  const isPositive = mode === "drawdown" ? latestVal <= 5 : latestVal >= 0;
  // Vibrant Bloomberg / CoinGecko colors
  const color = isPositive ? "var(--positive)" : "var(--negative)";

  const activeIndex = hoverIndex ?? values.length - 1;
  const activeVal = values[activeIndex];

  const firstVal = values[0];
  const delta = latestVal - firstVal;
  const deltaPct = firstVal !== 0 ? (delta / Math.abs(firstVal)) * 100 : null;

  const dateAt = (index: number) => {
    const snap = chronological[index];
    if (!snap?.snapshot_at) return "";
    return new Date(snap.snapshot_at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!geometry || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / (rect.width || 1)) * chartWidth;

    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < geometry.pts.length; i++) {
      const d = Math.abs(geometry.pts[i].x - x);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHoverIndex(nearest);
  };

  const formatTick = (t: number) =>
    new Date(t).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      ...(geometry?.spansMonths ? {} : { hour: "numeric" as const, minute: "2-digit" as const }),
    });

  const hoverX = hoverIndex !== null && geometry ? geometry.pts[hoverIndex].x : 0;
  const hoverY = hoverIndex !== null && geometry ? geometry.pts[hoverIndex].y : 0;
  const latestPt = geometry ? geometry.pts[geometry.pts.length - 1] : null;

  return (
    <Card className="surface-solid mb-8 p-5">
      {/* ── CoinGecko Style Header ───────────────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground-faint">
            Performance Trajectory
          </span>
          <div className="mt-1 flex items-baseline gap-3">
            <div
              className="font-mono text-3xl font-bold tabular-nums leading-none tracking-tight"
              style={{ color }}
            >
              {format(activeVal)}
            </div>
            {deltaPct !== null && mode !== "drawdown" && (
              <span
                className="font-mono text-xs font-semibold tabular-nums"
                style={{ color: delta >= 0 ? "var(--positive)" : "var(--negative)" }}
              >
                {delta >= 0 ? "+" : ""}
                {deltaPct.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] text-foreground-faint">
            {hoverIndex !== null ? dateAt(activeIndex) : `Latest · ${values.length} data points`}
          </div>
        </div>

        {/* Controls: Modes & Timeframe Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Selector */}
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 shadow-2xs font-mono text-[11px]">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.key}
                onClick={() => {
                  setTimeRange(tr.key);
                  setHoverIndex(null);
                }}
                className={`rounded px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                  timeRange === tr.key
                    ? "bg-foreground/10 text-foreground dark:bg-white/15"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>

          {/* Metric Selector */}
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 shadow-2xs font-mono text-[11px]">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setMode(m.key);
                  setHoverIndex(null);
                }}
                className={`rounded px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                  mode === m.key
                    ? "bg-foreground/10 text-foreground dark:bg-white/15"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chart Canvas ─────────────────────────────────────────────────── */}
      <div ref={containerCallbackRef} className="relative w-full select-none" style={{ height: HEIGHT }}>
        {geometry && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${chartWidth} ${HEIGHT}`}
            className="block w-full h-full cursor-crosshair"
            style={{ width: "100%", height: HEIGHT }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
            role="img"
            aria-label={`${MODES.find((m) => m.key === mode)?.label} over ${values.length} snapshots`}
          >
            <defs>
              <linearGradient id={`chart-fill-${mode}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="50%" stopColor={color} stopOpacity={0.06} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Horizontal gridlines with Right-Aligned Y-Axis Labels */}
            {geometry.ticks.map((t) => {
              const y = geometry.yAt(t);
              return (
                <g key={t}>
                  {t !== 0 && (
                    <line
                      x1={PAD.left}
                      y1={y}
                      x2={chartWidth - PAD.right}
                      y2={y}
                      className="stroke-border"
                      strokeWidth={1}
                      strokeDasharray="2 3"
                      opacity={0.65}
                    />
                  )}
                  {/* Y-Axis Value on the Right */}
                  <text
                    x={chartWidth - PAD.right + 8}
                    y={y}
                    textAnchor="start"
                    dominantBaseline="middle"
                    className="fill-foreground-faint font-mono"
                    fontSize={10}
                  >
                    {format(t, geometry.tickDecimals)}
                  </text>
                </g>
              );
            })}

            {/* Emphasized Zero baseline */}
            {geometry.zeroY !== null && (
              <line
                x1={PAD.left}
                y1={geometry.zeroY}
                x2={chartWidth - PAD.right}
                y2={geometry.zeroY}
                className="stroke-foreground/30"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {/* Subtle Vertical Gridlines at Date Ticks */}
            {geometry.timeTicks.slice(1, -1).map((tick) => (
              <line
                key={tick.i}
                x1={tick.x}
                y1={PAD.top}
                x2={tick.x}
                y2={PAD.top + geometry.plotH}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.4}
              />
            ))}

            {/* Bottom X-axis Time Labels */}
            {geometry.timeTicks.map((tick, n) => (
              <text
                key={tick.i}
                x={tick.x}
                y={HEIGHT - 8}
                textAnchor={n === 0 ? "start" : n === geometry.timeTicks.length - 1 ? "end" : "middle"}
                className="fill-foreground-faint font-mono"
                fontSize={10}
              >
                {formatTick(tick.t)}
              </text>
            ))}

            {/* Smooth Rich Gradient Area Fill */}
            <path d={geometry.area} fill={`url(#chart-fill-${mode})`} />

            {/* Main Smooth Price Curve */}
            <path
              key={`${mode}-${timeRange}`}
              d={geometry.line}
              fill="none"
              style={{ stroke: color }}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1 1"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="1"
                to="0"
                dur="0.45s"
                calcMode="spline"
                keySplines="0.4 0 0.2 1"
                fill="freeze"
              />
            </path>

            {/* ── CoinGecko Signature: Pinned Live Value Badge on Right Axis ── */}
            {latestPt && hoverIndex === null && (
              <g>
                {/* Horizontal dotted guide line connecting latest point to axis */}
                <line
                  x1={latestPt.x}
                  y1={latestPt.y}
                  x2={chartWidth - PAD.right + 2}
                  y2={latestPt.y}
                  stroke={color}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={0.6}
                />
                {/* Glowing live dot at current price */}
                <circle cx={latestPt.x} cy={latestPt.y} r={7} fill={color} opacity={0.2} />
                <circle cx={latestPt.x} cy={latestPt.y} r={3.5} fill={color} />

                {/* Pinned Pill Badge on the Right Axis */}
                <g transform={`translate(${chartWidth - PAD.right + 4}, ${latestPt.y - 9})`}>
                  <rect
                    width={PAD.right - 8}
                    height={18}
                    rx={4}
                    fill={color}
                  />
                  <text
                    x={(PAD.right - 8) / 2}
                    y={12.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    className="font-mono text-[10px] font-bold"
                  >
                    {format(latestVal, 2)}
                  </text>
                </g>
              </g>
            )}

            {/* ── Active Hover Crosshair ── */}
            {hoverIndex !== null && (
              <g pointerEvents="none">
                {/* Vertical Crosshair */}
                <line
                  x1={hoverX}
                  y1={PAD.top}
                  x2={hoverX}
                  y2={PAD.top + geometry.plotH}
                  stroke="currentColor"
                  className="text-foreground"
                  opacity={0.3}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {/* Horizontal Crosshair */}
                <line
                  x1={PAD.left}
                  y1={hoverY}
                  x2={chartWidth - PAD.right + 2}
                  y2={hoverY}
                  stroke="currentColor"
                  className="text-foreground"
                  opacity={0.3}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {/* Cursor Dot */}
                <circle cx={hoverX} cy={hoverY} r={7} fill={color} opacity={0.2} />
                <circle
                  cx={hoverX}
                  cy={hoverY}
                  r={3.5}
                  style={{ fill: "var(--background)", stroke: color }}
                  strokeWidth={2}
                />
                {/* Hover Value Badge on Right Axis */}
                <g transform={`translate(${chartWidth - PAD.right + 4}, ${hoverY - 9})`}>
                  <rect
                    width={PAD.right - 8}
                    height={18}
                    rx={4}
                    fill="currentColor"
                    className="text-foreground"
                  />
                  <text
                    x={(PAD.right - 8) / 2}
                    y={12.5}
                    textAnchor="middle"
                    fill="var(--background)"
                    className="font-mono text-[10px] font-bold"
                  >
                    {format(values[hoverIndex], 2)}
                  </text>
                </g>
              </g>
            )}
          </svg>
        )}

        {/* Floating Tooltip Pill */}
        {geometry && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs shadow-xl backdrop-blur"
            style={{
              left: Math.min(Math.max(hoverX, 70), chartWidth - PAD.right - 70),
              top: Math.max(hoverY - 54, 4),
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-bold tabular-nums" style={{ color }}>
              {format(values[hoverIndex])}
            </div>
            <div className="text-[10px] text-foreground-faint">{dateAt(hoverIndex)}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
