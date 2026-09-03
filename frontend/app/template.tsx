"use client";

import { useEffect, useRef } from "react";

/**
 * template.tsx re-mounts on every route change in Next.js App Router,
 * unlike layout.tsx which persists. This gives us a clean hook to run
 * a fade+slide-up animation on every navigation.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Kick off the animation after mount
    const anim = el.animate(
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0px)" },
      ],
      {
        duration: 220,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "forwards",
      }
    );

    anim.finished
      .then(() => {
        el.style.opacity = "1";
        el.style.transform = "none";
        anim.cancel();
      })
      .catch(() => {});

    return () => {
      anim.cancel();
    };
  }, []);

  return (
    <div ref={ref} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
