import type { HTMLAttributes } from "react";

type Variant = "default" | "muted" | "error" | "success";

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "surface text-foreground",
  // `.surface`, not a bare border: without a background the dither field shows
  // straight through the copy (same failure `.surface-hover` hit — see
  // globals.css). Muted differs from `default` in text weight, not in whether
  // the card is a surface at all.
  muted: "surface text-foreground-muted",
  error: "border border-negative/25 bg-negative/5 text-negative",
  success: "border border-positive/25 bg-positive/5 text-positive",
};

export function Card({
  variant = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      className={`rounded-xl p-5 text-sm ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
