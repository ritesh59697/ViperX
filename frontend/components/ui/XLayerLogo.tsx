import type { SVGProps } from "react";

/**
 * Official OKX X Layer network logo badge.
 */
export function XLayerLogo({
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
      <circle
        cx="12"
        cy="12"
        r="11.5"
        className="fill-black stroke-neutral-200 dark:stroke-neutral-700"
        strokeWidth="1"
      />
      <g className="fill-white">
        <path
          fillOpacity=".5"
          d="M17.174 14.316v4.154h1.133a.277.277 0 0 0 .276-.277v-3.6a.277.277 0 0 0-.276-.277zm0-8.316v4.154h1.133a.277.277 0 0 0 .276-.277v-3.6A.277.277 0 0 0 18.307 6z"
        />
        <path
          fillOpacity=".3"
          d="M19.297 6v4.154h.424a.277.277 0 0 0 .276-.277v-3.6A.277.277 0 0 0 19.722 6zm.003 8.316v4.154h.423a.277.277 0 0 0 .277-.277v-3.6a.277.277 0 0 0-.277-.277z"
        />
        <path
          d="M12.024 10.163H8.44a.275.275 0 0 0-.276.274v3.557c0 .151.124.274.276.274h3.582a.275.275 0 0 0 .276-.274v-3.557a.275.275 0 0 0-.275-.274M7.877 6h-3.6A.277.277 0 0 0 4 6.277v3.6c0 .153.124.277.277.277h3.6a.277.277 0 0 0 .277-.277v-3.6A.277.277 0 0 0 7.877 6m8.305 0h-3.6a.277.277 0 0 0-.277.277v3.6c0 .153.125.277.277.277h3.6a.277.277 0 0 0 .277-.277v-3.6A.277.277 0 0 0 16.182 6m-8.305 8.307h-3.6a.277.277 0 0 0-.277.277v3.6c0 .153.124.276.277.276h3.6a.277.277 0 0 0 .277-.276v-3.6a.277.277 0 0 0-.277-.277m8.305 0h-3.6a.277.277 0 0 0-.277.277v3.6c0 .153.125.276.277.276h3.6a.277.277 0 0 0 .277-.276v-3.6a.277.277 0 0 0-.277-.277"
        />
      </g>
    </svg>
  );
}

export default XLayerLogo;
