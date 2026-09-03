import type { SVGProps } from "react";

/**
 * Official Base logo with blue rounded square.
 */
export function BaseLogo({
  className = "h-3.5 w-3.5 shrink-0",
  ...props
}: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      {...props}
    >
      <circle cx="12" cy="12" r="12" fill="#FFFFFF" />
      <rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="#0052FF" />
    </svg>
  );
}
