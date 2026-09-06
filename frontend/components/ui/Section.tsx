import type { HTMLAttributes } from "react";

/**
 * The single content column. Every page uses this, so the site has exactly one
 * measure — the old mix of max-w-4xl/6xl/7xl per page was a big part of why
 * things felt inconsistent.
 *
 * `narrow` is the reading width for prose-led pages; `wide` exists only for
 * data tables that genuinely need the room.
 */
const WIDTHS = {
  narrow: "max-w-[46rem]",
  default: "max-w-[60rem]",
  wide: "max-w-[76rem]",
} as const;

export function Section({
  width = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { width?: keyof typeof WIDTHS }) {
  return (
    <div className="relative flex w-full flex-col items-center px-6">
      <div className={`w-full ${WIDTHS[width]} ${className}`.trim()} {...props} />
    </div>
  );
}
