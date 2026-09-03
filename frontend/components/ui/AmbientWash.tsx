import Image from "next/image";

type MaskDirection = "top" | "bottom" | "radial";

const MASKS: Record<MaskDirection, string> = {
  top: "linear-gradient(to bottom, black 0%, black 25%, transparent 88%)",
  bottom: "linear-gradient(to top, black 0%, black 25%, transparent 88%)",
  radial: "radial-gradient(ellipse 65% 65% at 50% 50%, black 0%, transparent 78%)",
};

/**
 * A decorative photo backdrop, faded into the surrounding background via a
 * CSS mask instead of a hard crop — the same technique the hero's ambient
 * wash already uses. Purely atmospheric: caller positions/sizes it (needs a
 * `relative` ancestor), this just handles the fade + low-opacity photo.
 */
export function AmbientWash({
  src,
  className = "",
  mask = "top",
  opacity = 0.4,
  priority = false,
  sizes = "100vw",
}: {
  src: string;
  className?: string;
  mask?: MaskDirection;
  opacity?: number;
  priority?: boolean;
  /** Match this to the wash's actual rendered width — defaults assume a full-bleed wash. */
  sizes?: string;
}) {
  const maskImage = MASKS[mask];

  return (
    <div className={`pointer-events-none absolute z-0 overflow-hidden ${className}`} aria-hidden="true">
      <Image
        src={src}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
        style={{ opacity, maskImage, WebkitMaskImage: maskImage }}
      />
    </div>
  );
}
