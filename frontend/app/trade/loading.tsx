export default function TradeLoading() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground font-sans antialiased select-none">
      {/* Top Header Skeleton */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/80 bg-background-elevated-solid px-3 sm:px-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-surface animate-pulse" />
          <div className="h-4 w-20 rounded bg-surface animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-20 rounded bg-surface animate-pulse" />
          <div className="h-7 w-28 rounded bg-surface animate-pulse" />
        </div>
      </header>

      {/* Ticker Bar Skeleton */}
      <div className="flex h-11 shrink-0 items-center border-b border-border/70 bg-background px-3 sm:px-4 gap-4">
        <div className="h-5 w-24 rounded bg-surface animate-pulse" />
        <div className="h-5 w-16 rounded bg-surface animate-pulse" />
        <div className="h-5 w-20 rounded bg-surface animate-pulse hidden md:block" />
        <div className="h-5 w-20 rounded bg-surface animate-pulse hidden lg:block" />
      </div>

      {/* Main Workspace Skeleton */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart + Positions */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-border/70">
          <div className="flex-1 w-full bg-surface/10 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-mono text-foreground-muted animate-pulse">
              <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
              <span>Loading Institutional Trading Terminal...</span>
            </div>
          </div>
          <div className="h-56 shrink-0 border-t border-border/70 bg-background p-3">
            <div className="h-4 w-32 rounded bg-surface animate-pulse mb-3" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-surface/50 animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-surface/50 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Order Book Skeleton */}
        <div className="hidden md:flex w-64 lg:w-72 xl:w-80 shrink-0 flex-col border-r border-border/70 p-3 gap-2">
          <div className="h-4 w-24 rounded bg-surface animate-pulse" />
          <div className="space-y-1 mt-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-surface/30 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Order Form Skeleton */}
        <div className="hidden md:flex w-72 lg:w-80 xl:w-96 shrink-0 flex-col p-4 gap-3 bg-surface/5">
          <div className="h-8 w-full rounded bg-surface animate-pulse" />
          <div className="h-10 w-full rounded bg-surface animate-pulse" />
          <div className="h-10 w-full rounded bg-surface animate-pulse" />
          <div className="h-12 w-full rounded bg-surface animate-pulse mt-auto" />
        </div>
      </div>
    </div>
  );
}

