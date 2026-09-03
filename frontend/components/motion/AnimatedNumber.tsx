"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { useReducedMotion } from "./useReducedMotion";

/** Spring-driven numeric counter — mounts at 0 and springs up to `value`,
 * then re-springs smoothly whenever `value` changes (e.g. a live refresh).
 * Renders through a MotionValue so updates skip React re-renders entirely. */
export function AnimatedNumber({
  value,
  decimals = 2,
  suffix = "",
  prefix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const spring = useSpring(0, { stiffness: 140, damping: 22, mass: 0.7 });
  const display = useTransform(spring, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  if (reduced) {
    return (
      <span className={className}>
        {prefix}
        {value.toFixed(decimals)}
        {suffix}
      </span>
    );
  }

  return <motion.span className={className}>{display}</motion.span>;
}
