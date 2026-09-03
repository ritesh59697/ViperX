"use client";

import React from "react";
import { motion } from "motion/react";
import Image from "next/image";

interface IllustrationProps {
  isHovered?: boolean;
}

/**
 * 1. Non-Custodial Vault & Cryptographic PDAs
 * Transparent PNG 3D isometric illustration with clean alpha edges (no muddy drop-shadow halo).
 */
export function NonCustodialIllustration({ isHovered = false }: IllustrationProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-visible select-none">
      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        animate={{
          scale: isHovered ? 1.05 : 1,
          y: isHovered ? -5 : 0,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <Image
          src="/illustrations/pure-silver-non-custodial.png"
          alt="Non-Custodial Cryptographic Security"
          fill
          className="object-contain pointer-events-none"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </motion.div>
    </div>
  );
}

/**
 * 2. Quantitative AI algotrading chart console
 * Transparent PNG 3D isometric illustration with clean alpha edges.
 */
export function QuantitativeAIIllustration({ isHovered = false }: IllustrationProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-visible select-none">
      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        animate={{
          scale: isHovered ? 1.05 : 1,
          y: isHovered ? -5 : 0,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <Image
          src="/illustrations/pure-silver-quantitative-ai.png"
          alt="Quantitative AI Algorithmic Trading"
          fill
          className="object-contain pointer-events-none"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </motion.div>
    </div>
  );
}

/**
 * 3. Risk-Adjusted: Volatility Wave & Knob Console
 * Transparent PNG 3D isometric illustration with clean alpha edges.
 */
export function RiskAdjustedIllustration({ isHovered = false }: IllustrationProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-visible select-none">
      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        animate={{
          scale: isHovered ? 1.05 : 1,
          y: isHovered ? -5 : 0,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <Image
          src="/illustrations/pure-silver-risk-adjusted.png"
          alt="Risk-Adjusted Sharpe Ratio Analytics"
          fill
          className="object-contain pointer-events-none"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </motion.div>
    </div>
  );
}

/**
 * 4. Anti-Gaming: Fraud Shield Console & verified assets
 * Transparent PNG 3D isometric illustration with clean alpha edges.
 */
export function AntiGamingIllustration({ isHovered = false }: IllustrationProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-visible select-none">
      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        animate={{
          scale: isHovered ? 1.05 : 1,
          y: isHovered ? -5 : 0,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <Image
          src="/illustrations/pure-silver-anti-gaming.png"
          alt="Anti-Gaming Transaction Verification"
          fill
          className="object-contain pointer-events-none"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </motion.div>
    </div>
  );
}
