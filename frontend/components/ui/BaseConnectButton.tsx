"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";

export function BaseConnectButton() {
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <ConnectButton.Custom>
      {({ account, chain, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return (
            <div className="h-[2.375rem] w-28 animate-pulse rounded-full bg-surface-hover" />
          );
        }

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer"
            >
              Connect
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              type="button"
              className="inline-flex h-[2.375rem] items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-[1.125rem] text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/40 cursor-pointer"
            >
              Wrong Network
            </button>
          );
        }

        return (
          <div className="relative" ref={rootRef}>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={`Wallet ${account.displayName}`}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-[2.375rem] items-center gap-2 rounded-full border border-border bg-surface px-[1.125rem] text-sm font-medium text-foreground transition-colors hover:bg-surface-hover cursor-pointer"
            >
              {chain.hasIcon && chain.iconUrl && (
                <img
                  alt={chain.name ?? "Chain icon"}
                  src={chain.iconUrl}
                  className="h-3.5 w-3.5 rounded-full"
                />
              )}
              {account.displayName}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className={`shrink-0 text-foreground-muted transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
              >
                <path
                  d="M2 4l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {menuOpen && (
              <div
                role="menu"
                aria-label="Wallet"
                className="absolute right-0 z-[80] mt-1.5 w-48 rounded-xl border border-border bg-background/95 p-1 shadow-xl backdrop-blur-xl"
              >
                <p
                  className="truncate px-2.5 pb-1 pt-1.5 font-mono text-[10px] text-foreground-faint"
                  title={account.address}
                >
                  {account.address}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(account.address);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-surface cursor-pointer"
                >
                  {copied ? "Copied" : "Copy address"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    disconnect();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-negative transition-colors hover:bg-negative/10 cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
