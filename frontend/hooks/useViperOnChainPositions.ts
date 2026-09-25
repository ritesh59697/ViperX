"use client";

import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import { keccak256, parseAbi, Address, toHex } from "viem";
import { useTradeStore, TradePosition } from "@/lib/trade/tradeStore";
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

export function useViperOnChainPositions() {
  const { address: userAddress, isConnected, chain } = useAccount();
  const { selectedMarket, markPrice, closedPositionIds } = useTradeStore();
  const { writeContractAsync } = useWriteContract();

  const currentVaultAddress = getViperVaultAddress(chain?.id);
  const isXLayer = chain?.id === 1952;

  // Check Long & Short position keys for the active market
  const activeMarketId = keccak256(toHex(selectedMarket.symbol));

  const { data: keyData, refetch: refetchKeys } = useReadContracts({
    contracts: userAddress
      ? [
          {
            address: currentVaultAddress,
            abi: VIPER_VAULT_ABI,
            functionName: "getPositionKey",
            args: [userAddress, activeMarketId, 0], // Long
          },
          {
            address: currentVaultAddress,
            abi: VIPER_VAULT_ABI,
            functionName: "getPositionKey",
            args: [userAddress, activeMarketId, 1], // Short
          },
          {
            address: currentVaultAddress,
            abi: VIPER_VAULT_ABI,
            functionName: "poolCollateralUsd",
          },
        ]
      : [],
    query: {
      refetchInterval: 4000,
    },
  });

  const longKey = keyData?.[0]?.result as `0x${string}` | undefined;
  const shortKey = keyData?.[1]?.result as `0x${string}` | undefined;
  const poolCollateralRaw = keyData?.[2]?.result as bigint | undefined;

  // Read position contents
  const { data: positionData, refetch: refetchPositions, isLoading } = useReadContracts({
    contracts: [
      ...(longKey
        ? [
            {
              address: currentVaultAddress,
              abi: VIPER_VAULT_ABI,
              functionName: "positions",
              args: [longKey],
            },
          ]
        : []),
      ...(shortKey
        ? [
            {
              address: currentVaultAddress,
              abi: VIPER_VAULT_ABI,
              functionName: "positions",
              args: [shortKey],
            },
          ]
        : []),
    ],
    query: {
      refetchInterval: 4000,
    },
  });

  const parsedOnChainPositions: TradePosition[] = [];

  if (positionData && positionData.length > 0) {
    positionData.forEach((res, index) => {
      if (res.status === "success" && res.result) {
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

        const posKey = index === 0 ? longKey : shortKey;
        const posId = `onchain-${index}-${mId.slice(0, 8)}`;
        const isClosed =
          closedPositionIds.includes(posId) ||
          (posKey ? closedPositionIds.includes(posKey) : false);

        if (sizeUsd > 0 && !isClosed) {
          const side = rawSide === 0 ? "long" : "short";
          const leverage = collateralUsd > 0 ? Math.round(sizeUsd / collateralUsd) : 1;
          const pnlUsd = calcUnrealizedPnl(side, sizeUsd, entryPrice, markPrice);
          const pnlPercent = calcPnlPercentage(pnlUsd, collateralUsd);
          const liqPrice = calcLiquidationPrice(side, entryPrice, leverage, 0.05);

          parsedOnChainPositions.push({
            id: posId,
            positionKey: posKey,
            market: selectedMarket.symbol,
            side,
            sizeUsd,
            collateralUsd,
            entryPrice,
            markPrice,
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
    },
    handleCloseOnChainPosition,
    isLoading: isConnected && isLoading,
  };
}
