"use client";

import { usePathname } from "next/navigation";

/**
 * template.tsx re-mounts on every route change in Next.js App Router.
 * Uses safe CSS animations instead of inline opacity:0 to prevent blank white screens
 * if hydration or Web Animations API is interrupted.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // On /trade terminal, render instantly with zero animation delay
  if (pathname?.startsWith("/trade")) {
    return <>{children}</>;
  }

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      {children}
    </div>
  );
}

