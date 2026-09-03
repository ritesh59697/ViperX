import type { SVGProps } from "react";

/**
 * Official Solana token badge (circular 1:1 with 3-bar gradient).
 */
export function SolanaLogo({
  className = "h-3.5 w-3.5 shrink-0",
  ...props
}: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      {...props}
    >
      <defs>
        <linearGradient x1="90.737%" y1="34.777%" x2="38.508%" y2="95.261%" id="sol-badge-grad-a">
          <stop stopColor="#00FFA3" offset="0%" />
          <stop stopColor="#DC1FFF" offset="100%" />
        </linearGradient>
        <linearGradient x1="66.444%" y1="11.834%" x2="13.914%" y2="72.317%" id="sol-badge-grad-b">
          <stop stopColor="#00FFA3" offset="0%" />
          <stop stopColor="#DC1FFF" offset="100%" />
        </linearGradient>
        <linearGradient x1="78.586%" y1="23.305%" x2="26.056%" y2="83.789%" id="sol-badge-grad-c">
          <stop stopColor="#00FFA3" offset="0%" />
          <stop stopColor="#DC1FFF" offset="100%" />
        </linearGradient>
      </defs>
      <circle fill="#141026" cx="18" cy="18" r="18" />
      <g transform="translate(6 9)">
        <path
          d="M3.9 14.355a.785.785 0 0 1 .554-.23h19.153c.35 0 .525.423.277.67l-3.783 3.784a.785.785 0 0 1-.555.23H.393a.392.392 0 0 1-.277-.67l3.783-3.784z"
          fill="url(#sol-badge-grad-a)"
        />
        <path
          d="M3.9.23c.15-.146.35-.23.554-.23h19.153c.35 0 .525.422.277.67l-3.783 3.783a.785.785 0 0 1-.555.23H.393a.392.392 0 0 1-.277-.67L3.899.229z"
          fill="url(#sol-badge-grad-b)"
        />
        <path
          d="M20.1 7.247a.785.785 0 0 0-.554-.23H.393a.392.392 0 0 0-.277.67l3.783 3.784c.145.145.344.23.555.23h19.153c.35 0 .525-.423.277-.67l-3.783-3.784z"
          fill="url(#sol-badge-grad-c)"
        />
      </g>
    </svg>
  );
}
