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
import { xLayerTestnet as viemXLayerTestnet, baseSepolia } from "viem/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

import "@solana/wallet-adapter-react-ui/styles.css";
import "@rainbow-me/rainbowkit/styles.css";

// Customized OKX X Layer Testnet Chain (Chain ID 1952)
export const xLayerTestnet = {
  ...viemXLayerTestnet,
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "OKB",
    symbol: "OKB",
  },
  rpcUrls: {
    default: {
      http: ["https://testrpc.xlayer.tech", "https://xlayertestrpc.okx.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "OKLink",
      url: "https://www.oklink.com/xlayer-test",
    },
  },
  testnet: true,
} as const;

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
  chains: [xLayerTestnet, baseSepolia],
  wallets: [
    {
      groupName: "Featured (OKX Dev Day)",
      wallets: [okxWallet, metaMaskWallet, rainbowWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
  transports: {
    [xLayerTestnet.id]: http("https://testrpc.xlayer.tech"),
    [baseSepolia.id]: http(),
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
