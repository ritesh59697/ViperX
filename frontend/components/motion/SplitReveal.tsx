"use client";

import { motion, type Variants } from "motion/react";
import { useReducedMotion } from "./useReducedMotion";

const TAGS = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  span: motion.span,
} as const;

type Tag = keyof typeof TAGS;

const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.015 },
  },
};

const char: Variants = {
  hidden: { opacity: 0, y: 6, filter: "blur(3px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

/**
 * Per-letter reveal, staggered left to right. Splits on words
 * first (each word gets `whitespace-nowrap` so it never breaks mid-word) then
 * on characters.
 */
export function SplitReveal({
  text,
  as = "span",
  className = "",
  delay = 0,
  once = true,
}: {
  text: string;
  as?: Tag;
  className?: string;
  /** Seconds to wait before the first letter starts. */
  delay?: number;
  /** Replay every time it scrolls into view instead of just once. */
  once?: boolean;
}) {
  const reduced = useReducedMotion();
  const words = text.split(" ");

  if (reduced) {
    const Plain = as;
    return <Plain className={className}>{text}</Plain>;
  }

  const MotionTag = TAGS[as];

  return (
    <MotionTag
      className={className}
      aria-label={text}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "0px" }}
      variants={container}
      transition={{ delayChildren: delay }}
    >
      <span aria-hidden="true">
        {words.map((word, wi) => (
          <span key={wi} className="inline-block whitespace-nowrap">
            {word.split("").map((c, ci) => (
              <motion.span key={ci} variants={char} className="inline-block will-change-[filter,transform,opacity]">
                {c}
              </motion.span>
            ))}
            {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
          </span>
        ))}
      </span>
    </MotionTag>
  );
}
