import type { HTMLAttributes } from "react";

export type CardVariant = "default" | "muted" | "error" | "success";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  selected?: boolean;
  interactive?: boolean;
  innerClassName?: string;
}

export function Card({
  variant = "default",
  selected = false,
  interactive = false,
  className = "",
  innerClassName = "",
  children,
  ...props
}: CardProps) {
  // Alert variants: direct single-layer banners
  if (variant === "error") {
    return (
      <div
        className={`rounded-xl border border-negative/25 bg-negative/5 p-5 text-sm text-negative ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (variant === "success") {
    return (
      <div
        className={`rounded-xl border border-positive/25 bg-positive/5 p-5 text-sm text-positive ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }

  // Token classification: separate layout/positioning (outer) from internal spacing/styling (inner)
  const outerClasses: string[] = [];
  const innerClasses: string[] = [];

  const tokens = className.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (
      /^p[xytrbl]?-/.test(token) ||
      /^text-/.test(token) ||
      /^font-/.test(token) ||
      /^leading-/.test(token) ||
      /^tracking-/.test(token) ||
      /^items-/.test(token) ||
      /^justify-/.test(token) ||
      /^gap-/.test(token) ||
      /^space-[xy]-/.test(token)
    ) {
      innerClasses.push(token);
    } else if (token === "flex" || token === "flex-col" || token === "flex-row") {
      // Flex container applies to both so inner fills outer and inner's children flex
      outerClasses.push(token);
      innerClasses.push(token);
    } else {
      outerClasses.push(token);
    }
  }

  if (innerClassName) {
    innerClasses.push(innerClassName);
  }

  // Default inner padding if not supplied
  if (!innerClasses.some((t) => /^p[xy]?-|^p-/.test(t))) {
    innerClasses.push("p-5");
  }

  const outerFrameStyles = selected
    ? "border-accent bg-accent/15 dark:border-accent dark:bg-accent/20"
    : "border-black/10 bg-neutral-200/60 dark:border-[#262626] dark:bg-[#141414]";

  const outerInteractive = interactive
    ? "transition-all duration-200 hover:border-accent/40"
    : "";

  const textColor = variant === "muted" ? "text-foreground-muted" : "text-foreground";

  return (
    <div
      className={`rounded-xl border p-1 ${outerFrameStyles} ${outerInteractive} ${outerClasses.join(" ")}`.trim()}
      {...props}
    >
      <div
        className={`h-full w-full rounded-lg bg-white dark:bg-[#0a0a0a] ${textColor} ${innerClasses.join(" ")}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
