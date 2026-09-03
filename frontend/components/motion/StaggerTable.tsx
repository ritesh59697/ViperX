"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "./useReducedMotion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

const row = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 360, damping: 32 } },
};

/** Table body that staggers its `StaggerRow` children in on mount. */
export function StaggerTableBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <tbody className={className}>{children}</tbody>;
  return (
    <motion.tbody className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.tbody>
  );
}

export function StaggerRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <tr className={className}>{children}</tr>;
  return (
    <motion.tr className={className} variants={row} whileHover={{ y: -1, transition: { duration: 0.15 } }}>
      {children}
    </motion.tr>
  );
}
