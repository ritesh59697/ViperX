"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PnlSnapshotRecord } from "@/lib/leaderboardApi";
import { Card } from "@/components/ui/Card";

type MetricMode = "pnl" | "roi" | "drawdown";

const MODES: { key: MetricMode; label: string }[] = [
  { key: "pnl", label: "Realized PnL" },
  { key: "roi", label: "ROI" },
  { key: "drawdown", label: "Max Drawdown" },
];

const HEIGHT = 260;
const FALLBACK_WIDTH = 720;
const PAD = { top: 18, right: 16, bottom: 28, left: 56 };

/**
 * "Nice" round tick values covering [min, max], plus the number of decimals
 * needed to print them without rounding a tick away from its own gridline
 * (a 0.025 step labelled "0.03" puts the text off the line it belongs to).
 */
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

/**
 * Monotone cubic path — smooths the line without ever overshooting a real data
 * point, so it can't invent a peak or trough the PNL data doesn't have.
 */
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
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // Fallback keeps the chart drawable if the container can't be measured
  // (SSR, a hidden/collapsed ancestor, no ResizeObserver).
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Render the SVG at true CSS-pixel size so the viewBox maps 1:1. Without
  // this the chart has to stretch to fill its box, which distorts stroke
  // widths, dashes, and circles non-uniformly.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setWidth(w > 0 ? w : FALLBACK_WIDTH);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    // Backstop for cases the observer alone misses — the card animating in,
    // or web fonts landing after mount and reflowing the row.
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const chronological = useMemo(() => [...snapshots].reverse(), [snapshots]);

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
    if (values.length < 2 || width <= 0) return null;

    const plotW = Math.max(width - PAD.left - PAD.right, 1);
    const plotH = HEIGHT - PAD.top - PAD.bottom;

    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    // A perfectly flat series has no range; give it a synthetic one so the
    // line sits mid-box instead of pinning to an edge.
    const pad = (dataMax - dataMin || Math.abs(dataMax) || 1) * 0.15;
    const min = dataMin - pad;
    const max = dataMax + pad;
    const range = max - min;

    // Ordinal (per-snapshot) x spacing, not a linear time scale. Snapshot
    // cadence is bursty — a true time axis crushes a whole trading session into
    // a few pixels next to an idle gap. Ticks are anchored to real data points
    // so every label still names the exact snapshot sitting under it, and long
    // gaps get their own marker below rather than being silently smoothed over.
    const xAt = (i: number) => PAD.left + (i / (values.length - 1)) * plotW;
    const yAt = (v: number) => PAD.top + plotH - ((v - min) / range) * plotH;

    const pts = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    const line = monotonePath(pts);
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(2)},${PAD.top + plotH} L ${pts[0].x.toFixed(2)},${PAD.top + plotH} Z`;

    // ~130px per label, or they collide on narrow screens.
    const tickCount = Math.max(2, Math.min(5, values.length, Math.floor(plotW / 130)));
    const timeTicks = Array.from({ length: tickCount }, (_, n) => {
      const i = Math.round((n / (tickCount - 1 || 1)) * (values.length - 1));
      return { i, x: xAt(i), t: times[i] };
    });

    const totalSpan = times[times.length - 1] - times[0];
    // Flag any interval eating >20% of the total span — the "nothing happened
    // here" stretches an ordinal axis would otherwise hide.
    const gaps: { x: number; hours: number }[] = [];
    if (isFinite(totalSpan) && totalSpan > 0) {
      for (let i = 1; i < times.length; i++) {
        const d = times[i] - times[i - 1];
        if (d / totalSpan > 0.2) {
          gaps.push({ x: (xAt(i - 1) + xAt(i)) / 2, hours: d / 3_600_000 });
        }
      }
    }

    const { ticks, decimals } = niceTicks(min, max, 4);

    return {
      pts,
      line,
      area,
      yAt,
      plotW,
      plotH,
      timeTicks,
      gaps,
      spansMonths: isFinite(totalSpan) && totalSpan > 30 * 24 * 60 * 60 * 1000,
      ticks: ticks.filter((t) => t >= min && t <= max),
      tickDecimals: decimals,
      zeroY: min <= 0 && max >= 0 ? yAt(0) : null,
    };
  }, [values, times, width]);

  if (snapshots.length < 2) {
    return (
      <Card variant="muted" className="mb-8">
        Insufficient PnL snapshot history to render visual performance chart. (Requires ≥ 2 data points)
      </Card>
    );
  }

  const latestVal = values[values.length - 1];
  const isPositive = mode === "drawdown" ? latestVal <= 5 : latestVal >= 0;
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

  // Points are unevenly spaced on a time axis, so snap to the nearest by x.
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!geometry || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;

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

  // Date alone collapses to the same label several times over when most
  // snapshots land in one session, so keep the time unless the span is long.
  const formatTick = (t: number) =>
    new Date(t).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      ...(geometry?.spansMonths ? {} : { hour: "numeric" as const, minute: "2-digit" as const }),
    });

  const hoverX = hoverIndex !== null && geometry ? geometry.pts[hoverIndex].x : 0;

  return (
    <Card className="surface-solid mb-8 p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-faint">
            Performance Trajectory
          </span>
          <div className="mt-1.5 flex items-baseline gap-3">
            <div
              className="font-mono text-3xl font-bold tabular-nums leading-none"
              style={{ color }}
            >
              {format(activeVal)}
            </div>
            {deltaPct !== null && mode !== "drawdown" && (
              <span
                className="font-mono text-xs tabular-nums"
                style={{ color: delta >= 0 ? "var(--positive)" : "var(--negative)" }}
              >
                {delta >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] text-foreground-faint">
            {hoverIndex !== null ? dateAt(activeIndex) : `Latest · ${values.length} snapshots`}
          </div>
        </div>

        <div className="flex rounded-lg border border-border bg-background-muted p-0.5 font-mono text-[11px]">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setMode(m.key);
                setHoverIndex(null);
              }}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                mode === m.key
                  ? "bg-background-elevated text-foreground font-semibold shadow-sm"
                  : "text-foreground-faint hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative w-full select-none" style={{ height: HEIGHT }}>
        {geometry && (
          <svg
            ref={svgRef}
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            className="block max-w-full cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
            role="img"
            aria-label={`${MODES.find((m) => m.key === mode)?.label} over ${values.length} snapshots`}
          >
            <defs>
              <linearGradient id={`chart-fill-${mode}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.22 }} />
                <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
              </linearGradient>
            </defs>

            {/* Vertical gridlines at the labelled snapshots */}
            {geometry.timeTicks.slice(1, -1).map((tick) => (
              <line
                key={tick.i}
                x1={tick.x}
                y1={PAD.top}
                x2={tick.x}
                y2={PAD.top + geometry.plotH}
                className="stroke-border"
                strokeWidth={1}
              />
            ))}

            {/* Idle-gap markers — x is per-snapshot, so long dead stretches
                would otherwise be invisible */}
            {geometry.gaps.map((gap) => (
              <g key={gap.x} className="fill-foreground-faint">
                <line
                  x1={gap.x}
                  y1={PAD.top}
                  x2={gap.x}
                  y2={PAD.top + geometry.plotH}
                  className="stroke-foreground/20"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
                <text x={gap.x} y={PAD.top - 6} textAnchor="middle" className="font-mono" fontSize={9}>
                  {gap.hours >= 48
                    ? `${Math.round(gap.hours / 24)}d gap`
                    : `${Math.round(gap.hours)}h gap`}
                </text>
              </g>
            ))}

            {/* Horizontal gridlines at round values, with axis labels */}
            {geometry.ticks.map((t) => (
              <g key={t}>
                {/* Skip at zero — the emphasised zero baseline is drawn below */}
                {t !== 0 && (
                  <line
                    x1={PAD.left}
                    y1={geometry.yAt(t)}
                    x2={width - PAD.right}
                    y2={geometry.yAt(t)}
                    className="stroke-border"
                    strokeWidth={1}
                  />
                )}
                <text
                  x={PAD.left - 10}
                  y={geometry.yAt(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-foreground-faint font-mono"
                  fontSize={10}
                >
                  {format(t, geometry.tickDecimals)}
                </text>
              </g>
            ))}

            {/* Zero baseline, emphasised over the plain gridlines */}
            {geometry.zeroY !== null && (
              <line
                x1={PAD.left}
                y1={geometry.zeroY}
                x2={width - PAD.right}
                y2={geometry.zeroY}
                className="stroke-foreground/25"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {/* X-axis time labels */}
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

            <path d={geometry.area} fill={`url(#chart-fill-${mode})`} />

            <path
              key={mode}
              d={geometry.line}
              fill="none"
              style={{ stroke: color }}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1 1"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="1"
                to="0"
                dur="0.55s"
                calcMode="spline"
                keySplines="0.4 0 0.2 1"
                fill="freeze"
              />
            </path>

            {hoverIndex !== null && (
              <g pointerEvents="none">
                <line
                  x1={hoverX}
                  y1={PAD.top}
                  x2={hoverX}
                  y2={PAD.top + geometry.plotH}
                  stroke="var(--foreground-muted)"
                  opacity={0.3}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle cx={hoverX} cy={geometry.pts[hoverIndex].y} r={7} fill={color} opacity={0.18} />
                <circle
                  cx={hoverX}
                  cy={geometry.pts[hoverIndex].y}
                  r={3.5}
                  style={{ fill: "var(--background)", stroke: color }}
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        )}

        {/* Tooltip — HTML so it can use the app's real surface styling */}
        {geometry && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border bg-background-elevated px-2.5 py-1.5 font-mono text-[11px] shadow-lg backdrop-blur"
            style={{
              left: Math.min(Math.max(hoverX, 60), width - 60),
              top: Math.max(geometry.pts[hoverIndex].y - 52, 0),
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-semibold tabular-nums" style={{ color }}>
              {format(values[hoverIndex])}
            </div>
            <div className="text-foreground-faint">{dateAt(hoverIndex)}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
