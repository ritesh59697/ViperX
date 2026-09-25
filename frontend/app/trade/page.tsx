"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram } from "@solana/web3.js";
import { parseUnits, formatUnits, keccak256, toHex, parseAbi } from "viem";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme } from "@/components/ui/ThemeProvider";
import { BaseLogo } from "@/components/ui/BaseLogo";
import { SolanaLogo } from "@/components/ui/SolanaLogo";
import { XLayerLogo } from "@/components/ui/XLayerLogo";
import { BaseConnectButton } from "@/components/ui/BaseConnectButton";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { useTradeStore, TradePosition } from "@/lib/trade/tradeStore";
import {
  calcPositionSize,
  calcLiquidationPrice,
  calcUnrealizedPnl,
  calcPnlPercentage,
} from "@/lib/trade/math";
import { useMarketData } from "@/hooks/useMarketData";
import { usePythPriceStream } from "@/hooks/usePythPriceStream";
import { useLiveTrades } from "@/hooks/useLiveTrades";
import { useOrderBook } from "@/hooks/useOrderBook";
import {
  useViperOnChainPositions,
  VIPER_VAULT_ABI,
  getViperVaultAddress,
} from "@/hooks/useViperOnChainPositions";

import { MarketTickerBar } from "@/components/trade/MarketTickerBar";
import { OrderBookPanel } from "@/components/trade/OrderBookPanel";
import { OrderFormPanel } from "@/components/trade/OrderFormPanel";
import { PositionsTable } from "@/components/trade/PositionsTable";
import { SharePnlModal } from "@/components/trade/SharePnlModal";
import { VerificationModal } from "@/components/trade/VerificationModal";
import { RuneIcon } from "@/components/ui/RuneIcon";
import { cn } from "@/lib/utils";

import { TradingViewWidget } from "@/components/trade/TradingViewWidget";
import { ChartPositionOverlay } from "@/components/trade/ChartPositionOverlay";
import { AccountEquityCard } from "@/components/trade/AccountEquityCard";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const USDC_XLAYER_TESTNET = (process.env.NEXT_PUBLIC_XLAYER_USDC || "0x6046c644ea622fBa3043F35d979BAEE83339cfEe") as `0x${string}`;

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function faucet() external",
]);

function getErrorMessage(err: unknown, fallback = "Transaction failed"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}

function explainCloseFailure(err: unknown, chainLabel: string): string {
  const raw = getErrorMessage(err);
  const lower = raw.toLowerCase();
  if (lower.includes("underflow") || lower.includes("overflow") || raw.includes("0x11")) {
    return `Close was rejected on ${chainLabel}. This position is still open, so a refresh shows it again. The market's open interest was reset to zero when max leverage was updated, and the vault cannot settle a close against that.`;
  }
  return `Failed to close position: ${raw}`;
}

function isUserRejection(err: unknown): boolean {
  if (!err) return false;
  const msg = getErrorMessage(err).toLowerCase();
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("user cancelled") ||
    msg.includes("user canceled") ||
    msg.includes("action_rejected") ||
    msg.includes("rejected the request") ||
    msg.includes("transaction was cancelled") ||
    msg.includes("transaction was canceled") ||
    msg.includes("4001")
  );
}

export default function TradePage() {
  const { theme } = useTheme();
  const { address: evmAddress, isConnected: isEvmConnected, chainId: currentChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { publicKey: solanaPublicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const {
    selectedMarket,
    selectedChain,
    setSelectedChain,
    side,
    leverage,
    collateralInput,
    useAgentDelegation,
    selectedAgentStrategy,
    takeProfitInput,
    stopLossInput,
    positions: sessionPositions,
    closedPositionIds,
    addPosition,
    removePosition,
    markPositionClosed,
    unmarkPositionClosed,
    shareModalPosition,
    setShareModalPosition,
  } = useTradeStore();

  // Navigation & Timeframe
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1m" | "5m" | "15m" | "1h" | "4h" | "1d">("15m");
  const [mobileTab, setMobileTab] = useState<"chart" | "book" | "trade">("chart");
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target as Node)) {
        setNetworkDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { openConnectModal } = useConnectModal();
  const { setVisible: setSolanaModalVisible } = useWalletModal();

  const handleConnectWallet = () => {
    if (isEvmChain) {
      openConnectModal?.();
    } else {
      setSolanaModalVisible(true);
    }
  };

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("viperx-active-chain");
    if (saved === "solana" || saved === "base" || saved === "xlayer") {
      setSelectedChain(saved as "solana" | "base" | "xlayer");
    } else {
      setSelectedChain("xlayer");
    }
    const handleChainChange = () => {
      const current = localStorage.getItem("viperx-active-chain");
      if (current === "solana" || current === "base" || current === "xlayer") {
        setSelectedChain(current as "solana" | "base" | "xlayer");
      }
    };
    window.addEventListener("viperx-chain-changed", handleChainChange);
    window.addEventListener("storage", handleChainChange);
    return () => {
      window.removeEventListener("viperx-chain-changed", handleChainChange);
      window.removeEventListener("storage", handleChainChange);
    };
  }, [setSelectedChain]);

  // Market Feeds & Hooks
  const { stats: initialStats } = useMarketData(selectedMarket, selectedTimeframe);
  const { priceData } = usePythPriceStream(selectedMarket.symbol);

  const stats = useMemo(
    () => ({
      ...initialStats,
      markPrice: priceData ? priceData.price : initialStats.markPrice,
    }),
    [initialStats, priceData]
  );

  const { trades: liveProtocolTrades } = useLiveTrades(20, 2500);
  const orderBook = useOrderBook(selectedMarket, stats.markPrice);

  // On-Chain Positions Hook (Base Sepolia)
  const {
    onChainPositions,
    poolCollateralUsd,
    refetchAll: refetchOnChainPositions,
    handleCloseOnChainPosition,
  } = useViperOnChainPositions();

  // Read Real On-Chain USDC Balance (Dynamic for X Layer Testnet & Base Sepolia)
  const isEvmChain = selectedChain === "base" || selectedChain === "xlayer";
  const currentUsdcAddress = selectedChain === "xlayer" ? USDC_XLAYER_TESTNET : USDC_BASE_SEPOLIA;

  const { data: usdcBalanceRaw, refetch: refetchUsdcBalance } = useReadContract({
    address: currentUsdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: evmAddress ? [evmAddress] : undefined,
    query: {
      enabled: Boolean(evmAddress && isEvmChain),
      refetchInterval: 4000,
    },
  });

  const availableBalanceUsd = useMemo(() => {
    if (isEvmChain) {
      if ((!isEvmConnected && !evmAddress) || usdcBalanceRaw === undefined) return 0;
      try {
        return Number(formatUnits(usdcBalanceRaw as bigint, 6));
      } catch {
        return 0;
      }
    }
    return 0;
  }, [isEvmChain, isEvmConnected, evmAddress, usdcBalanceRaw]);

  // Faucet claim state for X Layer Testnet
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);
  const handleClaimXLayerFaucet = async () => {
    if (!writeContractAsync || !evmAddress) {
      setNotification({ type: "error", msg: "Please connect your wallet first." });
      return;
    }
    try {
      setIsClaimingFaucet(true);
      if (currentChainId && currentChainId !== 1952 && switchChainAsync) {
        try {
          await switchChainAsync({ chainId: 1952 });
        } catch {
          // Fall through if switch request was dismissed
        }
      }
      const tx = await writeContractAsync({
        address: USDC_XLAYER_TESTNET,
        abi: ERC20_ABI,
        functionName: "faucet",
      });
      setNotification({
        type: "success",
        msg: "Successfully claimed 10,000 Test USDC on OKX X Layer!",
        tx,
      });
      await refetchUsdcBalance();
    } catch (err: unknown) {
      if (isUserRejection(err)) {
        setNotification({ type: "error", msg: "Faucet claim cancelled in wallet." });
        return;
      }
      setNotification({ type: "error", msg: `Faucet claim failed: ${getErrorMessage(err)}` });
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  // Transaction States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState("");
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    msg: string;
    tx?: string;
  } | null>(null);

  // Math
  const collateralNumber = parseFloat(collateralInput) || 0;
  const positionSizeUsd = calcPositionSize(collateralNumber, leverage);
  const estimatedLiqPrice = calcLiquidationPrice(side, stats.markPrice, leverage, 0.05);

  // Combined Positions (On-chain + Session)
  const allDisplayPositions = useMemo(() => {
    const combined: TradePosition[] = [];

    // 1. Process on-chain positions
    onChainPositions.forEach((cp) => {
      const isClosed =
        closedPositionIds.includes(cp.id) ||
        (cp.positionKey ? closedPositionIds.includes(cp.positionKey) : false);
      if (!isClosed) {
        combined.push(cp);
      }
    });

    // 2. Process session positions (deduplicating against on-chain)
    sessionPositions.forEach((sp) => {
      const isClosed =
        closedPositionIds.includes(sp.id) ||
        (sp.positionKey ? closedPositionIds.includes(sp.positionKey) : false);
      if (!isClosed) {
        const alreadyInCombined = combined.some(
          (cp) =>
            cp.id === sp.id ||
            (cp.market === sp.market && cp.side === sp.side)
        );
        if (!alreadyInCombined) {
          const currentPnlUsd = calcUnrealizedPnl(sp.side, sp.sizeUsd, sp.entryPrice, stats.markPrice);
          const currentPnlPct = calcPnlPercentage(currentPnlUsd, sp.collateralUsd);
          combined.push({
            ...sp,
            markPrice: stats.markPrice,
            pnlUsd: currentPnlUsd,
            pnlPercent: currentPnlPct,
          });
        }
      }
    });

    return combined;
  }, [onChainPositions, sessionPositions, closedPositionIds, stats.markPrice]);

  const activeMarketPosition = useMemo(
    () => allDisplayPositions.find((p) => p.market === selectedMarket.symbol) || null,
    [allDisplayPositions, selectedMarket.symbol]
  );

  const hasEvmWallet = Boolean(evmAddress) || isEvmConnected;
  const isWalletConnected = isEvmChain ? hasEvmWallet : !!solanaPublicKey;

  const handleCloseAllPositions = async () => {
    const toClose = [...allDisplayPositions];
    toClose.forEach((p) => markPositionClosed(p.id, p.positionKey));
    for (const pos of toClose) {
      await handleClosePosition(pos);
    }
  };

  // Execute Order
  const handleOpenPosition = async () => {
    if (collateralNumber < selectedMarket.minCollateral) {
      setNotification({
        type: "error",
        msg: `Minimum collateral for ${selectedMarket.symbol} is $${selectedMarket.minCollateral}.00 USDC.`,
      });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);
    setSubmitStatusText("Submitting order to sequencer...");

    try {
      let finalTxHash = "";

      if (isEvmChain && hasEvmWallet && evmAddress) {
        const isXLayer = selectedChain === "xlayer";
        const requiredChainId = isXLayer ? 1952 : 84532;
        const targetVault = getViperVaultAddress(requiredChainId);
        const activeUsdc = isXLayer ? USDC_XLAYER_TESTNET : USDC_BASE_SEPOLIA;
        const chainLabel = isXLayer ? "OKX X Layer Testnet" : "Base Sepolia";

        if (currentChainId && currentChainId !== requiredChainId && switchChainAsync) {
          try {
            setSubmitStatusText(`Switching wallet to ${chainLabel}...`);
            await switchChainAsync({ chainId: requiredChainId });
          } catch {
            // Continue if user already switched
          }
        }

        const marketId = keccak256(toHex(selectedMarket.symbol));
        const sideEnum = side === "long" ? 0 : 1;
        const sizeWei = parseUnits(positionSizeUsd.toFixed(6), 18);
        const collateralWei = parseUnits(collateralNumber.toFixed(6), 18);

        // Pre-check USDC balance and allowance on connected EVM chain
        if (publicClient) {
          const rawCollateral = BigInt(Math.floor(collateralNumber * 1e6)); // 6 decimals for USDC
          try {
            const userUsdcBal = await publicClient.readContract({
              address: activeUsdc,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [evmAddress],
            });

            if (userUsdcBal < rawCollateral) {
              setNotification({
                type: "error",
                msg: isXLayer
                  ? `Insufficient X Layer USDC (${(Number(userUsdcBal) / 1e6).toFixed(2)} USDC). Click 'Claim 10,000 USDC Faucet' above!`
                  : `Insufficient Base Sepolia USDC balance (${(Number(userUsdcBal) / 1e6).toFixed(2)} USDC). Claim free testnet USDC at faucet.circle.com.`,
              });
              return;
            }

            const userAllowance = await publicClient.readContract({
              address: activeUsdc,
              abi: ERC20_ABI,
              functionName: "allowance",
              args: [evmAddress, targetVault],
            });

            if (userAllowance < rawCollateral) {
              setSubmitStatusText(`Approve USDC collateral on ${chainLabel}...`);
              const approveTx = await writeContractAsync({
                address: activeUsdc,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [targetVault, rawCollateral],
              });
              setSubmitStatusText(`Confirming USDC approval on ${chainLabel}...`);
              const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
              if (approveReceipt.status !== "success") {
                setNotification({
                  type: "error",
                  msg: `USDC approval failed on ${chainLabel}.`,
                  tx: approveTx,
                });
                return;
              }
            }
          } catch (preCheckErr: unknown) {
            if (isUserRejection(preCheckErr)) {
              setNotification({
                type: "error",
                msg: "USDC approval was cancelled in your wallet.",
              });
              return;
            }
            setNotification({
              type: "error",
              msg: `Could not approve USDC for the vault: ${getErrorMessage(preCheckErr)}`,
            });
            return;
          }
        }

        setSubmitStatusText("Validating order parameters...");
        try {
          if (publicClient && evmAddress) {
            try {
              await publicClient.simulateContract({
                address: targetVault,
                abi: VIPER_VAULT_ABI,
                functionName: "openPosition",
                args: [marketId, sideEnum, sizeWei, collateralWei],
                account: evmAddress,
              });
            } catch (simErr: unknown) {
              const rawMsg = getErrorMessage(simErr);
              let userFriendlyMsg = rawMsg;
              if (rawMsg.includes("MaxLeverageExceeded") || rawMsg.includes("0x4b22439f")) {
                userFriendlyMsg = "Selected leverage exceeds the maximum limit for this market.";
              } else if (rawMsg.includes("InsufficientCollateral") || rawMsg.includes("0x82b42900")) {
                userFriendlyMsg = "Insufficient collateral or minimum position size requirement ($10) not met.";
              } else if (rawMsg.includes("MarketNotActive")) {
                userFriendlyMsg = "This market is currently paused or inactive.";
              } else if (rawMsg.includes("MaxOpenInterestExceeded")) {
                userFriendlyMsg = "Maximum open interest reached for this market.";
              } else if (
                rawMsg.includes("0xfb8f41b2") ||
                rawMsg.includes("ERC20InsufficientAllowance") ||
                rawMsg.toLowerCase().includes("insufficient allowance")
              ) {
                userFriendlyMsg = `This vault is not approved to spend your USDC. Approve ${chainLabel} USDC for the vault, then place the order again.`;
              }
              setNotification({
                type: "error",
                msg: `Order rejected: ${userFriendlyMsg}`,
              });
              return;
            }
          }

          setSubmitStatusText("Please confirm order in your wallet...");
          finalTxHash = await writeContractAsync({
            address: targetVault,
            abi: VIPER_VAULT_ABI,
            functionName: "openPosition",
            args: [marketId, sideEnum, sizeWei, collateralWei],
          });

          // Wait for block receipt and verify status!
          if (publicClient && finalTxHash.startsWith("0x")) {
            setSubmitStatusText(`Confirming on ${chainLabel}...`);
            const receipt = await publicClient.waitForTransactionReceipt({ hash: finalTxHash as `0x${string}` });
            if (receipt.status === "reverted") {
              setNotification({
                type: "error",
                msg: `Transaction reverted on ${chainLabel}. Check collateral allowance & balance.`,
                tx: finalTxHash,
              });
              return;
            }
          }

          await Promise.all([refetchOnChainPositions(), refetchUsdcBalance()]);
        } catch (contractErr: unknown) {
          if (isUserRejection(contractErr)) {
            setNotification({
              type: "error",
              msg: "Transaction was cancelled in your wallet.",
            });
            return;
          }
          setNotification({
            type: "error",
            msg: `On-chain execution failed: ${getErrorMessage(contractErr)}`,
          });
          return;
        }
      } else if (selectedChain === "solana" && solanaPublicKey && sendTransaction) {
        try {
          setSubmitStatusText("Signing Solana Devnet transaction...");
          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: solanaPublicKey,
              toPubkey: solanaPublicKey,
              lamports: 1000,
            })
          );
          const sig = await sendTransaction(tx, connection);
          finalTxHash = sig;
          setSubmitStatusText("Confirmed on Solana Devnet!");
        } catch (solErr: unknown) {
          if (isUserRejection(solErr)) {
            setNotification({
              type: "error",
              msg: "Transaction was cancelled in your wallet.",
            });
            return;
          }
          setNotification({
            type: "error",
            msg: `Solana transaction failed: ${getErrorMessage(solErr)}`,
          });
          return;
        }
      } else {
        // Disconnected demo mode only
        await new Promise((resolve) => setTimeout(resolve, 800));
        finalTxHash =
          selectedChain === "base"
            ? `0x${Array.from({ length: 64 }, () =>
              Math.floor(Math.random() * 16).toString(16)
            ).join("")}`
            : `5${Array.from({ length: 87 }, () =>
              "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[
              Math.floor(Math.random() * 58)
              ]
            ).join("")}`;
      }

      // Unmark any previous closed positions for this market so the new trade displays immediately
      const mId = keccak256(toHex(selectedMarket.symbol));
      unmarkPositionClosed(`onchain-0-${mId.slice(0, 8)}`);
      unmarkPositionClosed(`onchain-1-${mId.slice(0, 8)}`);

      // Add to session positions only after confirmed execution
      addPosition({
        id: `pos-${Date.now()}`,
        market: selectedMarket.symbol,
        side,
        sizeUsd: positionSizeUsd,
        collateralUsd: collateralNumber,
        entryPrice: stats.markPrice,
        markPrice: stats.markPrice,
        leverage,
        pnlUsd: 0,
        pnlPercent: 0,
        liqPrice: estimatedLiqPrice,
        takeProfitPrice: parseFloat(takeProfitInput) || undefined,
        stopLossPrice: parseFloat(stopLossInput) || undefined,
        txHash: finalTxHash,
        chain: selectedChain,
        openedAt: "Just now",
        agentName: useAgentDelegation ? selectedAgentStrategy : "Manual Trader",
      });

      setNotification({
        type: "success",
        msg: `Opened ${side.toUpperCase()} ${selectedMarket.symbol} position ($${positionSizeUsd.toFixed(2)}, ${leverage}x leverage)`,
        tx: finalTxHash,
      });
    } catch (err: unknown) {
      if (isUserRejection(err)) {
        setNotification({
          type: "error",
          msg: "Transaction was cancelled in your wallet.",
        });
      } else {
        setNotification({
          type: "error",
          msg: getErrorMessage(err, "Failed to execute order."),
        });
      }
    } finally {
      setIsSubmitting(false);
      setSubmitStatusText("");
    }
  };

  // Close Position Handler
  const handleClosePosition = async (pos: TradePosition) => {
    setIsSubmitting(true);
    setSubmitStatusText("Settling position on-chain...");
    setNotification(null);

    const chainLabel = selectedChain === "xlayer" ? "OKX X Layer" : "Base Sepolia";
    const canCloseOnChain = Boolean(
      pos.positionKey && isEvmChain && isEvmConnected && evmAddress
    );

    // Reject a close the vault will revert before hiding the row or opening the wallet.
    if (canCloseOnChain && publicClient && evmAddress && pos.positionKey) {
      try {
        await publicClient.simulateContract({
          address: getViperVaultAddress(currentChainId),
          abi: VIPER_VAULT_ABI,
          functionName: "closePosition",
          args: [pos.positionKey as `0x${string}`],
          account: evmAddress,
        });
      } catch (simErr: unknown) {
        if (!isUserRejection(simErr)) {
          setNotification({
            type: "error",
            msg: explainCloseFailure(simErr, chainLabel),
          });
          setIsSubmitting(false);
          setSubmitStatusText("");
          return;
        }
      }
    }

    // Hide only after the vault will accept the close.
    markPositionClosed(pos.id, pos.positionKey);

    try {
      let closeTxHash = pos.txHash;
      if (canCloseOnChain && pos.positionKey) {
        try {
          closeTxHash = await handleCloseOnChainPosition(pos.positionKey);
          if (publicClient && closeTxHash && closeTxHash.startsWith("0x")) {
            setSubmitStatusText(selectedChain === "xlayer" ? "Confirming on OKX X Layer..." : "Confirming on Base Sepolia...");
            const receipt = await publicClient.waitForTransactionReceipt({
              hash: closeTxHash as `0x${string}`,
            });
            if (receipt.status === "reverted") {
              throw new Error(selectedChain === "xlayer" ? "Close transaction reverted on OKX X Layer." : "Close transaction reverted on Base Sepolia.");
            }
          }
          await Promise.all([refetchOnChainPositions(), refetchUsdcBalance()]);
        } catch (contractErr: unknown) {
          if (isUserRejection(contractErr)) {
            unmarkPositionClosed(pos.id, pos.positionKey);
            setNotification({
              type: "error",
              msg: "Transaction was cancelled in your wallet.",
            });
            return;
          }

          const errMsg = getErrorMessage(contractErr);
          // If contract reverted because it was already deleted/closed on-chain
          if (
            errMsg.includes("PositionNotFound") ||
            errMsg.toLowerCase().includes("position not found") ||
            errMsg.includes("0x4a92c347")
          ) {
            removePosition(pos.id);
            refetchUsdcBalance();
            setNotification({
              type: "success",
              msg: `Position ${pos.market} is settled and closed on-chain.`,
            });
            return;
          }

          // Genuine failure: restore position in UI
          unmarkPositionClosed(pos.id, pos.positionKey);
          setNotification({
            type: "error",
            msg: explainCloseFailure(contractErr, chainLabel),
          });
          return;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      removePosition(pos.id);
      refetchUsdcBalance();
      setNotification({
        type: "success",
        msg: `Closed ${pos.side.toUpperCase()} ${pos.market} position.`,
        tx: closeTxHash,
      });
      // Automatically display verified cryptographic receipt modal
      setShareModalPosition(pos);
    } catch (err: unknown) {
      if (isUserRejection(err)) {
        unmarkPositionClosed(pos.id, pos.positionKey);
        setNotification({
          type: "error",
          msg: "Transaction was cancelled in your wallet.",
        });
      } else {
        unmarkPositionClosed(pos.id, pos.positionKey);
        setNotification({
          type: "error",
          msg: getErrorMessage(err, "Failed to close position."),
        });
      }
    } finally {
      setIsSubmitting(false);
      setSubmitStatusText("");
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground font-sans antialiased select-none">
      {/* ─── 1. TOP HEADER (Navigation & Networks) ─── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#e2e5eb] dark:border-[#1e1e1e] bg-white dark:bg-[#000000] px-3 sm:px-4 text-xs z-50">
        {/* Left: Brand Logo & Links */}
        <div className="flex items-center gap-5 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src="/viperx-logo-light.png"
              alt="ViperX"
              className="h-6 w-6 object-contain dark:hidden transition-transform duration-200 group-hover:scale-105"
            />
            <img
              src="/viperx-logo-option-1-exact-logo.png"
              alt="ViperX"
              className="h-6 w-6 object-contain hidden dark:block transition-transform duration-200 group-hover:scale-105"
            />
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold tracking-tight text-foreground group-hover:text-accent transition-colors text-sm">
                Viper<span className="text-accent">X</span>
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/trade"
              className="px-3 py-1 font-semibold text-accent border-b-2 border-accent text-xs"
            >
              Trade
            </Link>
            <Link
              href="/leaderboard"
              className="px-3 py-1 font-medium text-foreground-muted hover:text-foreground transition-colors text-xs"
            >
              Leaderboard
            </Link>
            <Link
              href="/arena"
              className="px-3 py-1 font-medium text-foreground-muted hover:text-foreground transition-colors text-xs"
            >
              Arena
            </Link>
            <Link
              href="/docs"
              target="_blank"
              className="px-3 py-1 font-medium text-foreground-muted hover:text-foreground transition-colors text-xs"
            >
              Docs ↗
            </Link>
          </nav>
        </div>

        {/* Right: Chain switcher, Theme & Wallet */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <ThemeToggle />

          {/* Network Switcher Dropdown (Matching Landing Page) */}
          <div className="relative" ref={networkDropdownRef}>
            <button
              type="button"
              onClick={() => setNetworkDropdownOpen((v) => !v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d2d6df] dark:border-[#1e1e1e] bg-white dark:bg-[#121212] px-3 text-xs font-semibold text-foreground transition-colors hover:border-border-strong cursor-pointer shadow-xs"
            >
              {selectedChain === "solana" ? (
                <>
                  <SolanaLogo className="h-3.5 w-3.5" />
                  <span>Solana</span>
                </>
              ) : selectedChain === "xlayer" ? (
                <>
                  <XLayerLogo className="h-3.5 w-3.5" />
                  <span>X Layer</span>
                </>
              ) : (
                <>
                  <BaseLogo className="h-3.5 w-3.5" />
                  <span>Base</span>
                </>
              )}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={cn(
                  "shrink-0 text-foreground-muted transition-transform duration-200",
                  networkDropdownOpen ? "rotate-180" : ""
                )}
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
            {networkDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-36 rounded-xl border border-[#d2d6df] dark:border-[#262626] bg-white/95 dark:bg-[#0f0f0f]/95 p-1 shadow-xl backdrop-blur-xl z-50">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChain("xlayer");
                    localStorage.setItem("viperx-active-chain", "xlayer");
                    window.dispatchEvent(new Event("viperx-chain-changed"));
                    setNetworkDropdownOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer",
                    selectedChain === "xlayer"
                      ? "bg-[#f2f4f8] dark:bg-[#1c1c1c] text-foreground font-bold"
                      : "text-foreground-muted hover:bg-surface hover:text-foreground"
                  )}
                >
                  <XLayerLogo className="h-3.5 w-3.5" />
                  <span>X Layer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChain("base");
                    localStorage.setItem("viperx-active-chain", "base");
                    window.dispatchEvent(new Event("viperx-chain-changed"));
                    setNetworkDropdownOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer",
                    selectedChain === "base"
                      ? "bg-[#f2f4f8] dark:bg-[#1c1c1c] text-foreground font-bold"
                      : "text-foreground-muted hover:bg-surface hover:text-foreground"
                  )}
                >
                  <BaseLogo className="h-3.5 w-3.5" />
                  <span>Base</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChain("solana");
                    localStorage.setItem("viperx-active-chain", "solana");
                    window.dispatchEvent(new Event("viperx-chain-changed"));
                    setNetworkDropdownOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer",
                    selectedChain === "solana"
                      ? "bg-[#f2f4f8] dark:bg-[#1c1c1c] text-foreground font-bold"
                      : "text-foreground-muted hover:bg-surface hover:text-foreground"
                  )}
                >
                  <SolanaLogo className="h-3.5 w-3.5" />
                  <span>Solana</span>
                </button>
              </div>
            )}
          </div>

          {/* X Layer Faucet Quick Claim Button */}
          {selectedChain === "xlayer" && hasEvmWallet && (
            <button
              type="button"
              onClick={handleClaimXLayerFaucet}
              disabled={isClaimingFaucet}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Claim 10,000 Test USDC on X Layer Testnet"
            >
              <RuneIcon name="action-sparkle" className="h-3 w-3 text-emerald-400" />
              <span>{isClaimingFaucet ? "Claiming..." : "Faucet (+10K USDC)"}</span>
            </button>
          )}

          {/* Wallet Connect */}
          {mounted ? (
            isEvmChain ? (
              <BaseConnectButton />
            ) : (
              <WalletMultiButton />
            )
          ) : (
            <div className="h-8 w-24 animate-pulse rounded bg-surface" />
          )}
        </div>
      </header>

      {/* ─── Notification Toast Banner ─── */}
      {notification && (
        <div
          className={cn(
            "flex items-center justify-between px-4 py-2 text-xs font-mono border-b animate-in fade-in-0 duration-200",
            notification.type === "success"
              ? "bg-positive/10 border-positive/30 text-positive"
              : "bg-negative/10 border-negative/30 text-negative"
          )}
        >
          <div className="flex items-center gap-2">
            <RuneIcon
              name={notification.type === "success" ? "indicators-circle-check" : "indicators-triangle-alert"}
              className="h-4 w-4"
            />
            <span>{notification.msg}</span>
            {notification.tx && (
              <a
                href={
                  selectedChain === "xlayer"
                    ? `https://www.oklink.com/xlayer-test/tx/${notification.tx}`
                    : selectedChain === "base"
                    ? `https://sepolia.basescan.org/tx/${notification.tx}`
                    : `https://solscan.io/tx/${notification.tx}?cluster=devnet`
                }
                target="_blank"
                rel="noreferrer"
                className="underline ml-2 hover:opacity-80 flex items-center gap-1"
              >
                <span>Explorer Proof</span>
                <RuneIcon name="indicators-square-arrow-out-up-right" className="h-3 w-3" />
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-foreground-muted hover:text-foreground cursor-pointer p-0.5 rounded hover:bg-surface"
            aria-label="Dismiss notification"
          >
            <RuneIcon name="indicators-x" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ─── Mobile View Tabs (Only visible on small screens) ─── */}
      <div className="flex md:hidden border-b border-border bg-surface text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMobileTab("chart")}
          className={cn(
            "flex-1 py-2.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5",
            mobileTab === "chart" ? "text-accent border-b-2 border-accent" : "text-foreground-muted"
          )}
        >
          <RuneIcon name="metrics-chart-line" className="h-3.5 w-3.5" />
          <span>Chart</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("book")}
          className={cn(
            "flex-1 py-2.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5",
            mobileTab === "book" ? "text-accent border-b-2 border-accent" : "text-foreground-muted"
          )}
        >
          <RuneIcon name="layouts-columns-3" className="h-3.5 w-3.5" />
          <span>Order Book</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("trade")}
          className={cn(
            "flex-1 py-2.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5",
            mobileTab === "trade" ? "text-accent border-b-2 border-accent" : "text-foreground-muted"
          )}
        >
          <RuneIcon name="tools-sliders-horizontal" className="h-3.5 w-3.5" />
          <span>Trade Form</span>
        </button>
      </div>

      {/* ─── 3. MAIN TERMINAL WORKSPACE (True Lighter Terminal Layout) ─── */}
      <div className="flex flex-1 overflow-hidden p-1 gap-1 bg-[#f2f3f5] dark:bg-[#000000]">
        {/* Main Workstation: Top (Chart + Order Book side-by-side) & Bottom (Full-Width Positions Table) */}
        <div
          className={cn(
            "flex flex-1 flex-col overflow-hidden min-w-0 gap-1 h-full",
            mobileTab === "trade" && "hidden md:flex"
          )}
        >
          {/* Top Half: Chart Card + Compact Order Book Card */}
          <div className="flex flex-1 overflow-hidden gap-1 min-h-0">
            {/* Card 1A: Chart Workstation */}
            <div
              className={cn(
                "flex flex-1 flex-col overflow-hidden min-w-0 relative rounded-[6px] border border-[#e2e5eb] dark:border-[#1e1e1e] bg-white dark:bg-[#000000]",
                mobileTab === "book" && "hidden md:flex"
              )}
            >
              {/* Integrated Market Info Ticker Bar (Top of Chart Card) */}
              <MarketTickerBar stats={stats} />

              {/* TradingView Chart */}
              <div className="flex-1 relative overflow-hidden min-h-[220px]">
                {mounted ? (
                  <>
                    <TradingViewWidget
                      symbol={selectedMarket.tvSymbol || selectedMarket.binanceSymbol || selectedMarket.symbol}
                      theme={theme === "light" ? "light" : "dark"}
                    />
                    <ChartPositionOverlay
                      position={activeMarketPosition}
                      markPrice={stats.markPrice}
                      onClosePosition={handleClosePosition}
                      isSubmitting={isSubmitting}
                    />
                  </>
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-white dark:bg-[#000000]">
                    <div className="flex items-center gap-2 text-xs font-mono text-foreground-muted animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                      <span>Connecting to Real-Time Market Stream...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 1B: Compact Order Book (Right side of Chart, exactly matching chart height) */}
            <div
              className={cn(
                "w-full md:w-64 lg:w-72 xl:w-80 shrink-0 rounded-[6px] border border-[#e2e5eb] dark:border-[#1e1e1e] bg-white dark:bg-[#000000] overflow-hidden flex flex-col h-full",
                mobileTab === "chart" && "hidden md:flex"
              )}
            >
              <OrderBookPanel
                orderBook={orderBook}
                recentTrades={liveProtocolTrades}
                precision={selectedMarket.precision}
              />
            </div>
          </div>

          {/* Bottom Half: Full-Width Positions & Fills Panel (Spans across BOTH Chart and Order Book) */}
          <div
            className={cn(
              "h-56 sm:h-64 shrink-0 rounded-[6px] border border-[#e2e5eb] dark:border-[#1e1e1e] bg-white dark:bg-[#000000] overflow-hidden flex flex-col",
              mobileTab === "book" && "hidden md:flex"
            )}
          >
            <PositionsTable
              positions={allDisplayPositions}
              poolCollateralUsd={poolCollateralUsd}
              onClosePosition={handleClosePosition}
              onCloseAllPositions={handleCloseAllPositions}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>

        {/* Right Sidebar: Unified Trading & Account Margin Overview */}
        <div
          className={cn(
            "w-full md:w-72 lg:w-80 xl:w-88 shrink-0 rounded-[6px] border border-[#e2e5eb] dark:border-[#1e1e1e] bg-white dark:bg-[#000000] overflow-hidden flex flex-col h-full",
            mobileTab !== "trade" && "hidden md:flex"
          )}
        >
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            <OrderFormPanel
              markPrice={stats.markPrice}
              isWalletConnected={isWalletConnected}
              isSubmitting={isSubmitting}
              submitStatusText={submitStatusText}
              availableBalanceUsd={availableBalanceUsd}
              onOpenPosition={handleOpenPosition}
              onConnectWallet={handleConnectWallet}
            />
            <AccountEquityCard
              availableUsdcBalance={availableBalanceUsd}
              positions={allDisplayPositions}
              isWalletConnected={isWalletConnected}
            />
          </div>
        </div>
      </div>

      {/* ─── 4. MODALS ─── */}
      {/* Viral PnL Share Card Modal */}
      {shareModalPosition && (
        <SharePnlModal
          position={shareModalPosition}
          onClose={() => setShareModalPosition(null)}
        />
      )}

      {/* Verification Protocol Modal */}
      <VerificationModal
        isOpen={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
      />
    </div>
  );
}
