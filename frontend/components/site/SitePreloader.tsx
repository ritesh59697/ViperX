"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { PixelPreloader } from "@/components/ui/PixelLoader";

const PRELOADER_SESSION_KEY = "viperx_intro_seen";

export function SitePreloader() {
  const pathname = usePathname();
  const isPreview = pathname?.startsWith("/preview");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPreview) return;

    // Check if the user already visited and saw the intro in this session
    const hasSeen = sessionStorage.getItem(PRELOADER_SESSION_KEY);
    const searchParams = new URLSearchParams(window.location.search);
    const forceShow = searchParams.get("preloader") === "1" || searchParams.get("intro") === "1";

    if (hasSeen && !forceShow) {
      return;
    }

    // First visit: show the preloader and record in sessionStorage
    setLoading(true);
    sessionStorage.setItem(PRELOADER_SESSION_KEY, "true");

    const timer = setTimeout(() => {
      setLoading(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, [isPreview]);

  if (!loading) return null;

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <PixelPreloader
          line1="Real Trades"
          line2="Verified Performance"
          line3="Onchain AI Agents"
          strokeColor="var(--accent, #d0200a)"
        />
      )}
    </AnimatePresence>
  );
}

export default SitePreloader;
