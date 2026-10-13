"use client";

import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { keccak256, parseAbi, Address, toHex } from "viem";
import { useTradeStore, TradePosition, SUPPORTED_MARKETS, PerpMarket } from "@/lib/trade/tradeStore";
import { calcUnrealizedPnl, calcPnlPercentage, calcLiquidationPrice, fromRawUnits } from "@/lib/trade/math";

export const XLAYER_VIPER_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_XLAYER_VIPER_VAULT || "0x9Dcfe752AC97F167763FeD87f4100F33cD29dbb7") as Address;
export const BASE_VIPER_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_BASE_VIPER_VAULT || "0x68c59b55359Dc36D9E842e7314Da1150a964f4C7") as Address;

export function getViperVaultAddress(chainId?: number): Address {
  if (chainId === 1952) return XLAYER_VIPER_VAULT_ADDRESS;
  return BASE_VIPER_VAULT_ADDRESS;
}

export const VIPER_VAULT_ADDRESS = BASE_VIPER_VAULT_ADDRESS;

export const VIPER_VAULT_ABI = parseAbi([
  "function getPositionKey(address trader, bytes32 marketId, uint8 side) external view returns (bytes32)",
  "function positions(bytes32 positionKey) external view returns (address trader, bytes32 marketId, uint8 side, uint256 sizeUsd, uint256 collateralUsd, uint256 entryPrice, uint256 entryBorrowIndex, uint256 openedAt)",
  "function poolCollateralUsd() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function openPosition(bytes32 marketId, uint8 side, uint256 sizeUsd, uint256 collateralUsd) external returns (bytes32)",
  "function closePosition(bytes32 positionKey) external returns (int256 realizedPnlUsd, uint256 payoutUsd)",
]);

interface MarketSideDescriptor {
  market: PerpMarket;
  side: "long" | "short";
  sideEnum: number;
  marketId: `0x${string}`;
}

const ALL_MARKET_SIDES: MarketSideDescriptor[] = SUPPORTED_MARKETS.flatMap((m) => [
  { market: m, side: "long" as const, sideEnum: 0, marketId: keccak256(toHex(m.symbol)) },
  { market: m, side: "short" as const, sideEnum: 1, marketId: keccak256(toHex(m.symbol)) },
]);

export function useViperOnChainPositions() {
  const { address: userAddress, isConnected, chain } = useAccount();
  const { selectedMarket, markPrice, closedPositionIds } = useTradeStore();
  const { writeContractAsync } = useWriteContract();

  const currentVaultAddress = getViperVaultAddress(chain?.id);
  const isXLayer = chain?.id === 1952;

  // 1. Fetch Pool Collateral
  const { data: poolCollateralRaw, refetch: refetchPoolCollateral } = useReadContract({
    address: currentVaultAddress,
    abi: VIPER_VAULT_ABI,
    functionName: "poolCollateralUsd",
    query: {
      refetchInterval: 10000,
    },
  });

  // 2. Build queries to fetch position keys for ALL markets & sides
  const keyContracts = useMemo(() => {
    if (!userAddress) return [];
    return ALL_MARKET_SIDES.map((item) => ({
      address: currentVaultAddress,
      abi: VIPER_VAULT_ABI,
      functionName: "getPositionKey" as const,
      args: [userAddress, item.marketId, item.sideEnum] as const,
    }));
  }, [userAddress, currentVaultAddress]);

  const { data: keyData, refetch: refetchKeys } = useReadContracts({
    contracts: keyContracts,
    query: {
      enabled: Boolean(userAddress && keyContracts.length > 0),
      refetchInterval: 4000,
    },
  });

  // 2. Map all non-zero keys to their descriptors
  const activeKeyItems = useMemo(() => {
    if (!keyData) return [];
    const items: { descriptor: MarketSideDescriptor; key: `0x${string}` }[] = [];
    ALL_MARKET_SIDES.forEach((desc, idx) => {
      const key = keyData[idx]?.result as `0x${string}` | undefined;
      if (key && key !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        items.push({ descriptor: desc, key });
      }
    });
    return items;
  }, [keyData]);

  // 3. Read position details across all markets with active keys
  const positionContracts = useMemo(() => {
    return activeKeyItems.map((item) => ({
      address: currentVaultAddress,
      abi: VIPER_VAULT_ABI,
      functionName: "positions" as const,
      args: [item.key],
    }));
  }, [activeKeyItems, currentVaultAddress]);

  const { data: positionData, refetch: refetchPositions, isLoading } = useReadContracts({
    contracts: positionContracts,
    query: {
      enabled: positionContracts.length > 0,
      refetchInterval: 4000,
    },
  });

  const parsedOnChainPositions: TradePosition[] = [];

  if (positionData && positionData.length > 0) {
    positionData.forEach((res, index) => {
      if (res.status === "success" && res.result) {
        const activeItem = activeKeyItems[index];
        if (!activeItem) return;

        const [
          trader,
          mId,
          rawSide,
          rawSizeUsd,
          rawCollateralUsd,
          rawEntryPrice,
          ,
          openedAtTimestamp,
        ] = res.result as unknown as [Address, `0x${string}`, number, bigint, bigint, bigint, bigint, bigint];

        const sizeUsd = fromRawUnits(rawSizeUsd, 18);
        const collateralUsd = fromRawUnits(rawCollateralUsd, 18);
        const entryPrice = fromRawUnits(rawEntryPrice, 18);

        const posKey = activeItem.key;
        const posId = `onchain-${activeItem.descriptor.sideEnum}-${mId.slice(0, 8)}`;
        const isClosed =
          closedPositionIds.includes(posId) ||
          (posKey ? closedPositionIds.includes(posKey) : false);

        if (sizeUsd > 0 && !isClosed) {
          const side = rawSide === 0 ? "long" : "short";
          const leverage = collateralUsd > 0 ? Math.round(sizeUsd / collateralUsd) : 1;
          
          // Use real-time mark price if this position belongs to the active market; otherwise fallback to basePrice
          const currentPrice =
            activeItem.descriptor.market.symbol === selectedMarket.symbol
              ? markPrice
              : activeItem.descriptor.market.basePrice;

          const pnlUsd = calcUnrealizedPnl(side, sizeUsd, entryPrice, currentPrice);
          const pnlPercent = calcPnlPercentage(pnlUsd, collateralUsd);
          const liqPrice = calcLiquidationPrice(side, entryPrice, leverage, 0.05);

          parsedOnChainPositions.push({
            id: posId,
            positionKey: posKey,
            market: activeItem.descriptor.market.symbol,
            side,
            sizeUsd,
            collateralUsd,
            entryPrice,
            markPrice: currentPrice,
            leverage,
            pnlUsd,
            pnlPercent,
            liqPrice,
            openedAt: new Date(Number(openedAtTimestamp) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            txHash: currentVaultAddress,
            agentName: `Connected Wallet (${trader.slice(0, 6)}...${trader.slice(-4)})`,
            chain: isXLayer ? "xlayer" : "base",
          });
        }
      }
    });
  }

  const handleCloseOnChainPosition = async (posKey: string) => {
    if (!writeContractAsync) throw new Error("Wallet not connected");
    return await writeContractAsync({
      address: currentVaultAddress,
      abi: VIPER_VAULT_ABI,
      functionName: "closePosition",
      args: [posKey as `0x${string}`],
    });
  };

  return {
    onChainPositions: parsedOnChainPositions,
    poolCollateralUsd: poolCollateralRaw ? fromRawUnits(poolCollateralRaw, 18) : 500000,
    refetchAll: () => {
      refetchKeys();
      refetchPositions();
      refetchPoolCollateral();
    },
    handleCloseOnChainPosition,
    isLoading: isConnected && isLoading,
  };
}

