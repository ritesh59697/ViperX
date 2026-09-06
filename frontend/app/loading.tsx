import { Section } from "@/components/ui/Section";
import { GridLoader } from "@/components/ui/GridLoader";

export default function RootLoading() {
  return (
    <Section width="wide" className="min-h-[60vh] flex flex-col items-center justify-center py-24 relative z-10">
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-background/95 backdrop-blur-[2px] p-8 sm:p-12 border border-border/40 shadow-xl">
        <GridLoader size={54} label="Syncing on-chain protocol state..." />
      </div>
    </Section>
  );
}
