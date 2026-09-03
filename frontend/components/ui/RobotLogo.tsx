"use client";

import { SVGProps, useEffect, useRef } from "react";

export function RobotLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    let rafId: number;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const distance = Math.hypot(deltaX, deltaY);

      // Bounds: max distance for full look, and horizontal/vertical travel caps
      const maxDistance = 250;
      const maxOffsetHorizontal = 10;
      const maxOffsetVertical = 8;

      // Use square root to make the eyes react and look toward the cursor quicker
      const ratio = Math.sqrt(Math.min(distance / maxDistance, 1));
      const angle = Math.atan2(deltaY, deltaX);

      target.x = Math.cos(angle) * ratio * maxOffsetHorizontal;
      target.y = Math.sin(angle) * ratio * maxOffsetVertical;
    };

    const update = () => {
      // Linear interpolation (lerp) for physics-based dampening (15% closer each frame)
      current.x += (target.x - current.x) * 0.15;
      current.y += (target.y - current.y) * 0.15;

      if (gRef.current) {
        gRef.current.style.transform = `translate(${current.x}px, ${current.y}px)`;
      }

      rafId = requestAnimationFrame(update);
    };

    window.addEventListener("mousemove", handleMouseMove);
    rafId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 80"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="faceGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbe9fe" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      {/* Side Ears */}
      <rect x="7" y="27" width="10" height="30" rx="4" fill="#141a1f" stroke="var(--foreground-faint)" strokeWidth="1" />
      <rect x="83" y="27" width="10" height="30" rx="4" fill="#141a1f" stroke="var(--foreground-faint)" strokeWidth="1" />

      {/* Outer Shell Head */}
      <rect x="13" y="12" width="74" height="60" rx="20" fill="#141a1f" stroke="var(--foreground-faint)" strokeWidth="1.5" />

      {/* Face Screen */}
      <rect x="18" y="17" width="64" height="50" rx="14" fill="url(#faceGradient)" />

      {/* Dynamic Pointer-tracking Eye Group */}
      <g
        ref={gRef}
        style={{
          transformOrigin: "center",
        }}
      >
        {/* Vertical Pill Eyes */}
        <rect x="34" y="33" width="9" height="20" rx="4" fill="#141a1f" />
        <rect x="58" y="33" width="9" height="20" rx="4" fill="#141a1f" />
      </g>
    </svg>
  );
}
