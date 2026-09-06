import { Section } from "@/components/ui/Section";
import { GridLoader } from "@/components/ui/GridLoader";

export default function TradeLoading() {
  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <div className="w-full flex flex-col gap-8 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl">
        <div className="flex flex-col items-center justify-center py-24">
          <GridLoader size={54} label="Connecting to Pyth Oracle & order books..." />
        </div>
      </div>
    </Section>
  );
}
