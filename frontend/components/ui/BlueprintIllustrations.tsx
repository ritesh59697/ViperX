"use client";

import React from "react";
import { motion } from "motion/react";
import Image from "next/image";

interface IllustrationProps {
  isHovered?: boolean;
}

/**
 * 1. Non-Custodial Vault & Delegated Key
 * Cybernetic handshake between human intuition and wireframe AI runtime.
 */
export function NonCustodialIllustration({ isHovered = false }: IllustrationProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-md border border-border/80 bg-black/60 select-none group/media">
      {/* Background vignette */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)]" />

      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        animate={{
          scale: isHovered ? 1.04 : 1,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        <Image
          src="/media/noble-the-vision.gif"
          alt="Non-Custodial Cryptographic Security"
          fill
          unoptimized
          style={{ objectPosition: "50% 10%" }}
          className="object-cover pointer-events-none opacity-90 transition-opacity duration-300 group-hover/media:opacity-100"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </motion.div>
    </div>
  );
}

/**
 * 2. Quantitative AI algotrading engine
 * 1-bit dithered intelligence holding the glowing orb of market liquidity.
 */
export function QuantitativeAIIllustration({ isHovered = false }: IllustrationProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-md border border-border/80 bg-black/60 select-none group/media">
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)]" />

      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        animate={{
          scale: isHovered ? 1.05 : 1,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        <Image
          src="/media/ai-abundance.gif"
          alt="Quantitative AI Algorithmic Trading Intelligence"
          fill
          unoptimized
          className="object-cover object-center pointer-events-none opacity-90 transition-opacity duration-300 group-hover/media:opacity-100"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </motion.div>
    </div>
  );
}

/**
 * 3. Risk-Adjusted: Volatility Radar & Sharpe Analytics
 * Burning structure representing systemic risk.
 */
export function RiskAdjustedIllustration({ isHovered = false }: IllustrationProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-md border border-border/80 bg-black/60 select-none group/media">
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.85)_100%)]" />

      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        animate={{
          scale: isHovered ? 1.05 : 1,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        <Image
          src="/media/tony-toranza.gif"
          alt="Risk-Adjusted Sharpe Ratio Analytics"
          fill
          unoptimized
          className="object-cover object-center pointer-events-none opacity-90 transition-opacity duration-300 group-hover/media:opacity-100"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </motion.div>
    </div>
  );
}

/**
 * 4. Anti-Gaming: Fraud Dissolution & Cryptographic Proof
 * Currency entropy dissolving into on-chain cryptographic settlement.
 */
export function AntiGamingIllustration({ isHovered = false }: IllustrationProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-md border border-border/80 bg-black/60 select-none group/media">
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.85)_100%)]" />

      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        animate={{
          scale: isHovered ? 1.04 : 1,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        <Image
          src="/media/dissolution-of-value.gif"
          alt="Anti-Gaming Transaction Verification & Entropy Dissolution"
          fill
          unoptimized
          className="object-cover object-center pointer-events-none opacity-90 transition-opacity duration-300 group-hover/media:opacity-100"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </motion.div>
    </div>
  );
}
