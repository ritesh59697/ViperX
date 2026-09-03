import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent-fill text-white font-medium hover:bg-accent-fill/90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none",
  // Carries a resting background, not just a border: these pills sit over the
  // dither field, and a transparent fill let it show through the label. Uses
  // --background-elevated (the same token `.surface` uses) rather than
  // --surface, whose 5%-alpha tint is meant for bare elements over a flat
  // parent and is far too sheer to cover the dither — the same distinction
  // globals.css draws for .surface-hover.
  secondary:
    "border border-border bg-background-elevated text-foreground font-medium hover:border-border-strong hover:bg-background-elevated-hover active:scale-[0.98]",
  // Emphasised secondary. `secondary`'s border is only rgba(255,255,255,0.1)
  // in dark mode, so a lone outline button next to an accent-filled one reads
  // as disabled. This keeps the accent for the true primary action but gives
  // the companion action a solid surface and a border you can actually see.
  outline:
    "surface-solid border border-border-strong text-foreground font-medium hover:border-accent hover:text-accent active:scale-[0.98]",
  ghost: "text-foreground-muted hover:text-foreground hover:bg-surface",
};

// No glow, no wide tracking: the accent fill is enough emphasis on a
// monochrome page, and the shadow read as dated next to the reference sites.
const BASE_CLASSES =
  "group inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[0.9375rem] font-sans transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer";

type CommonProps = {
  variant?: Variant;
  active?: boolean;
  className?: string;
};

type ButtonAsLink = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  };

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

export type ButtonProps = ButtonAsLink | ButtonAsButton;

export function Button({ variant = "primary", active, className = "", ...props }: ButtonProps) {
  // Inverted rather than accent-tinted: a 10%-alpha accent fill over a dark
  // page read as a muddy, half-disabled pill next to the crisp outlined
  // inactive ones, and it competed with the accent CTA sitting beside it.
  // Swapping fore/background is unambiguous in both themes and stays out of
  // the accent's way.
  // `!text-background` is important-flagged on purpose: the secondary variant
  // already emits `text-foreground`, and two same-specificity utilities are
  // resolved by stylesheet order, not by their order in this string. Without
  // the flag the active pill rendered foreground-on-foreground (1.00:1).
  // `!bg-accent-secondary` is flagged for exactly the same reason, and became
  // necessary when `secondary` gained a resting `bg-background-elevated`:
  // unflagged, the active pill could lose its fill to the variant's background
  // depending only on which utility Tailwind emits later.
  const activeClasses = active
    ? "border-accent-secondary !bg-accent-secondary !text-background font-semibold"
    : "";
  const classes = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${activeClasses} ${className}`.trim();
  // Labels render as-is. The previous hover text-swap wrapped every string
  // label in an overflow-hidden box locked to height:1.2em, which clipped
  // descenders and truncated anything that wrapped past one line.
  const label = props.children;

  if (props.href) {
    const { href, ...rest } = props as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...rest}>
        {label}
      </Link>
    );
  }

  const { ...rest } = props as ButtonAsButton;
  return (
    <button className={classes} {...rest}>
      {label}
    </button>
  );
}
