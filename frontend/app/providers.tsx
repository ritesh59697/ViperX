"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

import { ThemeProvider } from "@/components/ui/ThemeProvider";

// EVM Wallet Connections
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import {
  okxWallet,
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider, http } from "wagmi";
import { defineChain } from "viem";
import { XLAYER_NETWORK } from "@/lib/xlayer";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

import "@solana/wallet-adapter-react-ui/styles.css";
import "@rainbow-me/rainbowkit/styles.css";

// The X Layer network named in env (testnet 1952 or mainnet 196) — see lib/xlayer.ts.
export const xLayerChain = defineChain({
  id: XLAYER_NETWORK.chainId,
  name: XLAYER_NETWORK.name,
  nativeCurrency: { decimals: 18, name: "OKB", symbol: "OKB" },
  rpcUrls: { default: { http: [XLAYER_NETWORK.rpcUrl] } },
  blockExplorers: { default: { name: "OKLink", url: XLAYER_NETWORK.explorer } },
  testnet: XLAYER_NETWORK.testnet,
});

if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const firstArg = typeof args[0] === "string" ? args[0] : "";
    if (
      firstArg.includes("cloud.reown.com") ||
      firstArg.includes("not found on Allowlist") ||
      firstArg.includes("Origin http://localhost") ||
      firstArg.includes("Pyth SSE Error") ||
      firstArg.includes("EventSource")
    ) {
      return;
    }
    originalError(...args);
  };

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = typeof reason === "string" ? reason : reason?.message || "";
    if (msg.includes("cloud.reown.com") || msg.includes("not found on Allowlist")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

const queryClient = new QueryClient();

const config = getDefaultConfig({
  appName: "ViperX",
  projectId: "990176cdfaec50875c754d9b62fefd7a",
  chains: [xLayerChain],
  wallets: [
    {
      groupName: "Featured (OKX Dev Day)",
      wallets: [okxWallet, metaMaskWallet, rainbowWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
  transports: {
    [xLayerChain.id]: http(XLAYER_NETWORK.rpcUrl),
  },
  ssr: true,
});

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet");

export function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ThemeProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme()}>
            <ConnectionProvider endpoint={RPC_URL}>
              <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
              </WalletProvider>
            </ConnectionProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
