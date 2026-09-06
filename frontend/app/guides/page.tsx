import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { ArrowRightGlyph } from "@/components/ui/StatusGlyphs";

export default function GuidesPage() {
  const steps = [
    {
      title: "Deploying Your First AI Trading Agent",
      desc: "Connect your wallet, select a preset strategy engine (Trend Following, RSI, or Grid), configure the initial name & bounds, and sign the deployment transaction to register the agent PDA.",
    },
    {
      title: "How Verified Fills Work",
      desc: "To earn a leaderboard rank, agents must execute actual trades on the blockchain (EVM on Base or SVM on Solana). The background indexer polls these accounts and verifies fills directly against on-chain position changes, separating real trades from fake database reporting.",
    },
    {
      title: "Backtest Parameter Integration",
      desc: "Before deploying capital, use the Backtest Lab to run simulated trades against historical data. You can automatically carry over your best-performing backtest configurations into the Agent Deployment page with one click.",
    },
    {
      title: "Custody and Delegated Execution",
      desc: "ViperX uses a secure non-custodial model. Your collateral stays in your account or vault, and the execution runner only holds delegated authorization to open and close trading positions on your behalf.",
    },
  ];

  return (
    <Section width="wide" className="pt-6 pb-20 sm:pt-8 relative z-10">
      <div className="w-full flex flex-col gap-8 bg-background/95 backdrop-blur-[2px] p-5 sm:p-9 rounded-2xl">
        <div>
          <span className="t-label">Resources</span>
          <h1 className="t-h2 mt-3 text-foreground">User Guides</h1>
          <p className="t-body mt-2 max-w-[58ch] text-sm">
            Everything you need to know about setting up, backtesting, deploying, and verifying your AI agents on ViperX.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {steps.map((step, idx) => (
            <Card key={idx} interactive className="p-6">
              <span className="font-mono text-xs text-accent font-semibold">GUIDE 0{idx + 1}</span>
              <h2 className="text-base font-bold text-foreground mt-2">{step.title}</h2>
              <p className="t-body-sm text-foreground-muted mt-3 leading-relaxed text-xs">
                {step.desc}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-4 text-center font-mono text-xs">
          <span className="text-foreground-faint">Need more advanced technical details?</span>
          <a
            href="https://docs.viperx.site"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-accent underline hover:text-accent/80 transition-colors inline-flex items-center gap-1"
          >
            <span>View Protocol Documentation</span>
            <ArrowRightGlyph className="h-3 w-3" />
          </a>
        </div>
      </div>
    </Section>
  );
}
