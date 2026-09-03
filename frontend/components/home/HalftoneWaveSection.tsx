import { SplitReveal } from "@/components/motion/SplitReveal";

const FEATURES = [
  {
    title: "Momentum, mean-reversion, and market-making engines",
    body: "Every registered agent runs a real quantitative strategy against live devnet orderbooks, reacting to on-chain price signals tick by tick with no manual babysitting.",
  },
  {
    title: "One indexer, every risk metric",
    body: "Trade logs, realized PnL, drawdown, and Sharpe ratio all flow through the same off-chain pipeline, so every agent on the leaderboard is measured by the same rules.",
  },
];

/**
 * Deterministic halftone dot-wave: dot radius follows a Gaussian falloff from
 * a sine-wave centerline, the same "thick band of dots" illusion as a classic
 * halftone print. Pure math (no RNG) so server- and client-rendered markup
 * always match.
 */
function generateWaveDots() {
  const cols = 46;
  const rows = 14;
  const width = 600;
  const height = 360;
  const dx = width / (cols - 1);
  const dy = height / (rows - 1);
  const amplitude = 110;
  const freq = 0.145;
  const sigma = 38;
  const maxRadius = 4.6;

  const dots: { x: number; y: number; r: number; accent: boolean }[] = [];

  for (let col = 0; col < cols; col++) {
    const x = col * dx;
    const centerY = height / 2 + amplitude * Math.sin(col * freq);

    for (let row = 0; row < rows; row++) {
      const y = row * dy;
      const distance = Math.abs(y - centerY);
      const r = maxRadius * Math.exp(-(distance * distance) / (2 * sigma * sigma));

      if (r < 0.35) continue;
      dots.push({ x, y, r, accent: distance < sigma * 0.6 });
    }
  }

  return dots;
}

export function HalftoneWaveSection() {
  const dots = generateWaveDots();

  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
      <div>
        <span className="eyebrow-pill">Execution engine</span>
        <SplitReveal
          as="h2"
          text="Built for the next generation of on-chain trading agents"
          className="mt-4 font-serif text-4xl font-semibold text-foreground leading-tight"
        />

        <div className="mt-8 space-y-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <div>
                <h3 className="text-sm font-bold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-border bg-background p-4 sm:p-6 shadow-[0_20px_50px_-15px_rgba(47,107,255,0.25)]">
        <svg viewBox="0 0 600 360" className="w-full" role="presentation" aria-hidden="true">
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={d.r}
              className={d.accent ? "fill-accent" : "fill-accent-secondary"}
              opacity={d.accent ? 0.85 : 0.45}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
