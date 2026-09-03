"use client";

import Link from "next/link";
import { useState } from "react";
import { ScrambleOnHover } from "@/components/motion/ScrambleOnHover";
import { ArrowRightGlyph } from "@/components/ui/StatusGlyphs";

/**
 * The page's loudest control: a full-width accent bar whose mono label
 * decrypts on hover and whose arrow tracks right.
 *
 * Hover state is owned here rather than left to CSS `:hover` because the
 * scramble is a JS animation that needs an explicit start/stop signal, not a
 * style change. Focus counts as hover so keyboard users get the same effect.
 */
export function BarLink({
  href,
  children,
  variant,
}: {
  href: string;
  children: string;
  variant?: "dark";
}) {
  const [hot, setHot] = useState(false);

  return (
    <Link
      href={href}
      className={`bp-bar ${variant === "dark" ? "bp-bar--dark" : ""}`}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
    >
      <ScrambleOnHover text={children} active={hot} />
      <span className="bp-bar-arrow inline-flex items-center" aria-hidden="true">
        <ArrowRightGlyph className="h-4 w-4" />
      </span>
    </Link>
  );
}
