"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

interface BrandLogoMenuProps {
  onAction?: () => void;
  className?: string;
}

export function BrandLogoMenu({ onAction, className = "" }: BrandLogoMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown, { passive: true });
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleGoHome = () => {
    setIsOpen(false);
    onAction?.();
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/");
    }
  };

  const handleScrollToTop = () => {
    setIsOpen(false);
    onAction?.();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={`relative shrink-0 ${className}`} ref={menuRef}>
      {/* Brand / Logo Trigger Button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        whileTap={{ scale: 0.96 }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="ViperX logo and quick actions menu"
        style={{ touchAction: "manipulation" }}
        className="group flex shrink-0 items-center gap-2.5 rounded-xl px-1 py-1 transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer select-none"
      >
        <img
          src="/viperx-logo-light.png"
          alt="ViperX Logo"
          className="h-8 w-8 object-contain dark:hidden transition-transform duration-200 group-hover:scale-105"
        />
        <img
          src="/viperx-logo-option-1-exact-logo.png"
          alt="ViperX Logo"
          className="h-8 w-8 object-contain hidden dark:block transition-transform duration-200 group-hover:scale-105"
        />
        <span className="font-sans text-[1.18rem] font-bold tracking-tight leading-none">
          <span className="text-foreground">Viper</span>
          <span className="text-accent">X</span>
        </span>
      </motion.button>

      {/* Pop-up Card Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            aria-orientation="vertical"
            className="absolute left-0 top-full mt-2 z-[80] w-52 sm:w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/90 dark:border-white/10 bg-background/95 dark:bg-black/90 p-1.5 shadow-2xl dark:shadow-[0_16px_40px_rgba(0,0,0,0.9)] dark:ring-1 dark:ring-white/5 backdrop-blur-3xl"
          >
            {/* Go to Home Page */}
            <button
              type="button"
              role="menuitem"
              onClick={handleGoHome}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-surface-hover dark:hover:bg-white/[0.08] transition-colors cursor-pointer select-none"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-foreground-muted group-hover:text-foreground dark:group-hover:text-white transition-colors"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Go to Home Page</span>
            </button>

            {/* Scroll to Top */}
            <button
              type="button"
              role="menuitem"
              onClick={handleScrollToTop}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-surface-hover dark:hover:bg-white/[0.08] transition-colors cursor-pointer select-none"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-foreground-muted group-hover:text-foreground dark:group-hover:text-white transition-colors"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
              <span>Scroll to Top</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
