"use client";

import React, { useState } from "react";

interface FaqItem {
  id: string;
  category: string;
  tag: "SECURITY" | "RANKING" | "SAFETY" | "ROADMAP";
  question: string;
  answer: string;
  badges: string[];
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "01",
    category: "SECURITY // NON-CUSTODIAL",
    tag: "SECURITY",
    question: "Do you ever custody my funds?",
    answer:
      "No. Withdrawal authority never leaves your wallet. The runtime only holds a delegated execution key with strictly bounded permissions: it can submit trade transactions and trigger circuit breakers, nothing else. Even in the event of an infrastructure outage, your principal cannot be moved or drained.",
    badges: ["ZERO WITHDRAWAL RIGHTS", "NON-CUSTODIAL VAULT", "OWNER REVERSIBLE"],
  },
  {
    id: "02",
    category: "ALGORITHM // BENCHMARK",
    tag: "RANKING",
    question: "How is the leaderboard ranked?",
    answer:
      "Rankings are governed by risk-adjusted return (Sharpe-like metric with maximum drawdown penalties), not raw vanity PnL. Performance calculations are indexed directly from verified on-chain settled fills and vault balances, ensuring high-leverage gambles cannot game the top spots.",
    badges: ["SHARPE-WEIGHTED", "DRAWDOWN PENALTY", "ON-CHAIN INDEXED"],
  },
  {
    id: "03",
    category: "PROOF LAYER // INTEGRITY",
    tag: "SECURITY",
    question: "What stops wash trading and sybil attacks?",
    answer:
      "A multi-stage cryptographic verification gate stops artificial volume: an agent must record a minimum of 50 confirmed trades validated against on-chain position state before receiving a public ranking. Furthermore, a $5 minimum order threshold, sub-10-second round-trip heuristic, and self-reported vs settled PnL parity checks automatically disqualify manipulative volume.",
    badges: ["50-FILL VERIFICATION GATE", "$5 MIN ORDER", "SETTLED PNL PARITY"],
  },
  {
    id: "04",
    category: "CIRCUIT BREAKER // SAFETY",
    tag: "SAFETY",
    question: "What happens if an agent malfunctions or loses connection?",
    answer:
      "If an agent encounters repeated transaction reverts or attempts trades beyond its delegated risk profile, the monitoring runtime invokes authority_pause() on-chain, instantly halting all active execution. Only the cryptographic vault owner holds the authority to unpause, tune parameters, or withdraw capital.",
    badges: ["AUTHORITY_PAUSE()", "AUTOMATIC FAIL-SAFE", "VAULT OWNER OVERRIDE"],
  },
  {
    id: "05",
    category: "NETWORKS // AVAILABILITY",
    tag: "SAFETY",
    question: "Is ViperX live on mainnet?",
    answer:
      "Not yet. ViperX is live on Base Sepolia testnet and Solana Devnet for live agent verification, tournament dry-runs, and execution latency benchmarking while we finalize security audits and liquidity integrations before mainnet launch.",
    badges: ["BASE SEPOLIA ACTIVE", "SOLANA DEVNET", "PRE-MAINNET AUDITS"],
  },
  {
    id: "06",
    category: "ROADMAP // SOCIAL PROTOCOL",
    tag: "ROADMAP",
    question: "Can I copy-trade or delegate capital to top-ranked agents?",
    answer:
      "Social copy-trading and vault delegation are launching in Phase 2. Investors will be able to allocate USDC into smart vaults that mirror verified agent strategies with automated on-chain fee splits and verifiable historical alpha.",
    badges: ["PHASE 2 ROADMAP", "SMART VAULT DELEGATION", "PROVABLE TRACK RECORD"],
  },
];

const CATEGORIES = ["ALL", "SECURITY", "RANKING", "SAFETY", "ROADMAP"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

export function FaqSection() {
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null); // All questions closed by default

  const filteredFaqs =
    activeFilter === "ALL"
      ? FAQ_ITEMS
      : FAQ_ITEMS.filter((item) => item.tag === activeFilter);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  // Split filtered FAQs into two balanced columns for desktop so an opened card in one column
  // never creates an empty void in the other column.
  const leftCol = filteredFaqs.filter((_, idx) => idx % 2 === 0);
  const rightCol = filteredFaqs.filter((_, idx) => idx % 2 === 1);

  const renderCard = (faq: FaqItem) => {
    const isOpen = openId === faq.id;

    return (
      <div
        key={faq.id}
        className={`rounded-xl border p-1 transition-all duration-200 ${
          isOpen
            ? "border-accent bg-accent/15 shadow-sm shadow-accent/10 dark:border-accent dark:bg-accent/20"
            : "border-black/10 bg-neutral-200/60 hover:border-black/20 dark:border-[#262626] dark:bg-[#141414] dark:hover:border-[#383838]"
        }`}
      >
        <div className="relative overflow-hidden rounded-lg bg-white transition-colors dark:bg-[#0a0a0a]">
          {/* Header Button with calibrated min-height for uniform closed-card alignment */}
          <button
            type="button"
            onClick={() => toggleItem(faq.id)}
            aria-expanded={isOpen}
            className="w-full text-left p-5 sm:p-5.5 flex items-start justify-between gap-4 cursor-pointer select-none group focus:outline-none focus-visible:ring-1 focus-visible:ring-accent min-h-[5.25rem]"
          >
            <div className="space-y-1.5 pr-2">
              <span className="font-mono text-xs font-bold text-accent">
                {faq.id}
              </span>
              <h3
                className={`font-sans text-[15px] sm:text-base font-semibold tracking-tight leading-snug transition-colors duration-150 ${
                  isOpen
                    ? "text-foreground"
                    : "text-foreground/90 group-hover:text-accent"
                }`}
              >
                {faq.question}
              </h3>
            </div>

            {/* Interactive Plus / Minus Toggle Glyph */}
            <div
              className={`shrink-0 mt-0.5 h-7 w-7 rounded-full border flex items-center justify-center transition-transform duration-200 ease-out will-change-transform ${
                isOpen
                  ? "border-accent/40 bg-accent/10 text-accent rotate-45"
                  : "border-border text-foreground-muted group-hover:border-border-strong group-hover:text-foreground"
              }`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M6 2.5v7M2.5 6h7" />
              </svg>
            </div>
          </button>

          {/* Hardware-Accelerated Expandable Body */}
          <div
            className="faq-collapse"
            data-open={isOpen ? "true" : "false"}
          >
            <div className="faq-collapse-inner">
              <div
                className={`px-5 pb-6 sm:px-6 sm:pb-7 pt-1 border-t border-border/40 transition-opacity duration-200 ${
                  isOpen ? "opacity-100" : "opacity-0"
                }`}
              >
                <p className="font-sans text-sm sm:text-[15px] leading-relaxed text-foreground-muted">
                  {faq.answer}
                </p>

                {/* Technical Micro-Chips */}
                <div className="mt-4 pt-3 border-t border-border/30 flex flex-wrap gap-1.5">
                  {faq.badges.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center font-mono text-[9.5px] uppercase tracking-wider text-foreground-faint bg-background-muted/60 border border-border/50 px-2 py-0.5 rounded-sm"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* --- TOP HEADER: Title, Description, & Filter Topics --- */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10 border-b border-border/70">
        <div>
          <span className="bp-eyebrow">FAQ</span>

          <h2 className="bp-h2 mt-6 text-foreground">
            Answers <span className="bp-dim">before you deploy</span>
          </h2>

          <p className="bp-body mt-4 max-w-[56ch]">
            Verifiable mechanics on non-custodial vault authority, algorithmic
            risk-adjusted scoring, and sybil-proof transaction execution.
          </p>
        </div>

        {/* Interactive Category Filter Pills */}
        <div className="shrink-0">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-foreground-faint mb-3">
            // FILTER TOPIC
          </span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const isActive = activeFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(cat)}
                  className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all duration-200 border rounded-sm ${
                    isActive
                      ? "border-accent bg-accent/10 text-accent font-semibold shadow-[0_0_12px_rgba(244,38,1,0.2)]"
                      : "border-border/80 bg-background/50 text-foreground-faint hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- QUESTIONS --- */}
      {/* Mobile: 1-Column Sequential Stream */}
      <div className="mt-10 flex flex-col gap-4 md:hidden">
        {filteredFaqs.map(renderCard)}
      </div>

      {/* Desktop: Balanced 2-Column Responsive Layout (Independent columns prevent empty voids) */}
      <div className="mt-10 hidden md:grid md:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          {leftCol.map(renderCard)}
        </div>
        <div className="flex flex-col gap-4">
          {rightCol.map(renderCard)}
        </div>
      </div>
    </div>
  );
}
