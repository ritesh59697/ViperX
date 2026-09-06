import { Section } from "@/components/ui/Section";
import { GridLoader } from "@/components/ui/GridLoader";

export default function DashboardLoading() {
  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <div className="w-full flex flex-col gap-8 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl">
        <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 sm:flex-row sm:items-end">
          <div>
            <span className="t-label">Workspace</span>
            <h1 className="text-3xl sm:text-4xl font-bold font-mono text-foreground mt-2 tracking-tight">Wallet Dashboard</h1>
            <p className="t-body mt-2 max-w-[54ch] text-sm">
              Monitor your deployed SV/EV agents, active copy subscriptions, and strategy performance.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-20">
          <GridLoader size={54} label="Loading workspace data..." />
        </div>
      </div>
    </Section>
  );
}
