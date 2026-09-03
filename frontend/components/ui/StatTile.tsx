import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

export function StatTile({
  label,
  value,
  mono,
  animate,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
  /** When set, the tile springs the number up from 0 instead of rendering `value` statically. */
  animate?: { value: number; decimals?: number; suffix?: string };
}) {
  return (
    // h-full matters: the grid stretches the stagger wrapper around this tile
    // to the tallest cell in the row, but without it the tile only grows to its
    // own content. The `mono` variant sets its value at text-xs rather than
    // text-lg, so Owner/Vault came out 12px shorter than their row neighbours.
    <div className="surface-solid group h-full rounded-xl border border-border p-4 shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-border-strong hover:shadow-lg">
      <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
        {label}
      </div>
      <div
        className={`mt-1.5 text-lg font-bold text-foreground transition-colors group-hover:text-accent ${mono ? "font-mono text-xs text-accent" : ""}`}
      >
        {animate && Number.isFinite(animate.value) ? (
          <AnimatedNumber value={animate.value} decimals={animate.decimals ?? 2} suffix={animate.suffix ?? ""} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}
