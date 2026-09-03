import type { SVGProps } from "react";

type StatusGlyphProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

const BASE_PROPS = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ariaProps(title: string | undefined) {
  return title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
}

export function CheckGlyph({ className = "h-3.5 w-3.5", title, ...props }: StatusGlyphProps) {
  return (
    <svg {...BASE_PROPS} {...ariaProps(title)} className={className} {...props}>
      <path d="M3.1 8.1 6.4 11.2 13 4.6" />
    </svg>
  );
}

export function XGlyph({ className = "h-3.5 w-3.5", title, ...props }: StatusGlyphProps) {
  return (
    <svg {...BASE_PROPS} {...ariaProps(title)} className={className} {...props}>
      <path d="M4.4 4.4 11.6 11.6M11.6 4.4 4.4 11.6" />
    </svg>
  );
}

export function ArrowRightGlyph({ className = "h-3.5 w-3.5", title, ...props }: StatusGlyphProps) {
  return (
    <svg {...BASE_PROPS} {...ariaProps(title)} className={className} {...props}>
      <path d="M3 8h9" />
      <path d="m8.7 4.5 3.5 3.5-3.5 3.5" />
    </svg>
  );
}

export function InfoGlyph({ className = "h-3.5 w-3.5", title, ...props }: StatusGlyphProps) {
  return (
    <svg {...BASE_PROPS} {...ariaProps(title)} className={className} {...props}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.2v3.6" />
      <circle cx="8" cy="4.8" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
