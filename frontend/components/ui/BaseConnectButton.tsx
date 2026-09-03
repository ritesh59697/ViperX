"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function BaseConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return (
            <div className="h-[2.375rem] w-28 animate-pulse rounded-full bg-surface-hover" />
          );
        }

        return (
          <div>
            {(() => {
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
                <button
                  onClick={openAccountModal}
                  type="button"
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
                </button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
