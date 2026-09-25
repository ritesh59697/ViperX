import { create } from "zustand";
import { PositionSide, calcUnrealizedPnl, calcPnlPercentage } from "./math";

export interface PerpMarket {
  symbol: string;
  name: string;
  category?: "crypto" | "equity";
  binanceSymbol: string;
  equityTicker?: string;
  tvSymbol?: string;
  pythFeedId: string;
  basePrice: number;
  minCollateral: number;
  maxLeverage: number;
  precision: number;
}

export const SUPPORTED_MARKETS: PerpMarket[] = [
  // Crypto Perpetuals
  {
    symbol: "ETH-PERP",
    name: "Ethereum",
    category: "crypto",
    binanceSymbol: "ETHUSDT",
    tvSymbol: "BINANCE:ETHUSDT",
    pythFeedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    basePrice: 2450.0,
    minCollateral: 10,
    maxLeverage: 10,
    precision: 2,
  },
  {
    symbol: "BTC-PERP",
    name: "Bitcoin",
    category: "crypto",
    binanceSymbol: "BTCUSDT",
    tvSymbol: "BINANCE:BTCUSDT",
    pythFeedId: "0xe62df6e875746b43f8000b0b152753545192ddc4203240d23e1112c0200ecd92",
    basePrice: 65420.0,
    minCollateral: 20,
    maxLeverage: 10,
    precision: 2,
  },
  {
    symbol: "SOL-PERP",
    name: "Solana",
    category: "crypto",
    binanceSymbol: "SOLUSDT",
    tvSymbol: "BINANCE:SOLUSDT",
    pythFeedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    basePrice: 142.5,
    minCollateral: 5,
    maxLeverage: 10,
    precision: 3,
  },
  {
    symbol: "OKB-PERP",
    name: "OKB (OKX Ecosystem)",
    category: "crypto",
    binanceSymbol: "OKBUSDT",
    tvSymbol: "OKX:OKBUSDT",
    pythFeedId: "0x7179069d2d0b5220c74cfcf5705a2e5e8e8156cd0c558c407c6f0e4d0fb8396e",
    basePrice: 48.0,
    minCollateral: 5,
    maxLeverage: 10,
    precision: 2,
  },
  // Tokenized Equities & RWA Perps (Pyth Oracle Powered)
  {
    symbol: "NVDA-PERP",
    name: "NVIDIA Corp (RWA)",
    category: "equity",
    binanceSymbol: "",
    equityTicker: "NVDA",
    tvSymbol: "NASDAQ:NVDA",
    pythFeedId: "0x5a54e99f0e8f000efcead7818e6e9b8971d8ad2327663f73966035eb41cf6b48",
    basePrice: 119.5,
    minCollateral: 10,
    maxLeverage: 10,
    precision: 2,
  },
  {
    symbol: "TSLA-PERP",
    name: "Tesla Inc (RWA)",
    category: "equity",
    binanceSymbol: "",
    equityTicker: "TSLA",
    tvSymbol: "NASDAQ:TSLA",
    pythFeedId: "0x160934149021a0081d6d8db8618e5f8b9e67d4e41416e6378e906b38c2ef40a6",
    basePrice: 228.4,
    minCollateral: 10,
    maxLeverage: 10,
    precision: 2,
  },
  {
    symbol: "COIN-PERP",
    name: "Coinbase Global (RWA)",
    category: "equity",
    binanceSymbol: "",
    equityTicker: "COIN",
    tvSymbol: "NASDAQ:COIN",
    pythFeedId: "0x19d554a93a7e584feab5253805494d6e9f90cf9a3e20e8b15d2a9ff60e20f4f9",
    basePrice: 184.2,
    minCollateral: 10,
    maxLeverage: 10,
    precision: 2,
  },
  {
    symbol: "SPY-PERP",
    name: "S&P 500 ETF (RWA)",
    category: "equity",
    binanceSymbol: "",
    equityTicker: "SPY",
    tvSymbol: "AMEX:SPY",
    pythFeedId: "0x2613da66c6155551c682aa15259926a458b2914db368297f62939d37537b02ff",
    basePrice: 558.0,
    minCollateral: 20,
    maxLeverage: 10,
    precision: 2,
  },
];

export interface TradePosition {
  id: string;
  positionKey?: string;
  market: string;
  side: PositionSide;
  sizeUsd: number;
  collateralUsd: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  pnlUsd: number;
  pnlPercent: number;
  liqPrice: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  openedAt: string;
  txHash: string;
  agentName?: string;
  chain: "base" | "solana" | "xlayer";
}

export interface TradeState {
  // Chain
  selectedChain: "base" | "solana" | "xlayer";
  setSelectedChain: (chain: "base" | "solana" | "xlayer") => void;

  // Market
  selectedMarket: PerpMarket;
  markPrice: number;
  price24hChange: number;
  priceHistory: number[];
  setSelectedMarket: (market: PerpMarket) => void;
  setMarkPrice: (price: number) => void;
  setPrice24hChange: (pct: number) => void;
  pushPriceTick: (price: number) => void;

  // Order Form
  side: PositionSide;
  leverage: number;
  collateralInput: string;
  takeProfitInput: string;
  stopLossInput: string;
  slippageTolerance: number;
  postOnly: boolean;
  reduceOnly: boolean;
  useAgentDelegation: boolean;
  selectedAgentStrategy: string;

  setSide: (side: PositionSide) => void;
  setLeverage: (leverage: number) => void;
  setCollateralInput: (val: string) => void;
  setTakeProfitInput: (val: string) => void;
  setStopLossInput: (val: string) => void;
  setSlippageTolerance: (val: number) => void;
  setPostOnly: (val: boolean) => void;
  setReduceOnly: (val: boolean) => void;
  setUseAgentDelegation: (val: boolean) => void;
  setSelectedAgentStrategy: (val: string) => void;

  // Positions
  positions: TradePosition[];
  closedPositionIds: string[];
  addPosition: (pos: TradePosition) => void;
  removePosition: (id: string) => void;
  markPositionClosed: (id: string, positionKey?: string) => void;
  unmarkPositionClosed: (id: string, positionKey?: string) => void;
  updatePositionTpSl: (id: string, tp?: number, sl?: number) => void;
  syncPositionsMarkPrice: (symbol: string, currentMarkPrice: number) => void;

  // Viral PnL Share Card Modal
  shareModalPosition: TradePosition | null;
  setShareModalPosition: (pos: TradePosition | null) => void;

  // Tabs
  activeTab: "positions" | "liquidity" | "trades";
  setActiveTab: (tab: "positions" | "liquidity" | "trades") => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  // Chain
  selectedChain: "base",
  setSelectedChain: (selectedChain) => set({ selectedChain }),

  // Market
  selectedMarket: SUPPORTED_MARKETS[0],
  markPrice: SUPPORTED_MARKETS[0].basePrice,
  price24hChange: 0,
  priceHistory: [SUPPORTED_MARKETS[0].basePrice],
  setSelectedMarket: (selectedMarket) =>
    set({
      selectedMarket,
      markPrice: selectedMarket.basePrice,
      priceHistory: [selectedMarket.basePrice],
      takeProfitInput: "",
      stopLossInput: "",
    }),
  setMarkPrice: (markPrice) => set({ markPrice }),
  setPrice24hChange: (price24hChange) => set({ price24hChange }),
  pushPriceTick: (price) =>
    set((state) => {
      const history = [...state.priceHistory, price];
      if (history.length > 50) history.shift();
      return { priceHistory: history };
    }),

  // Order Form
  side: "long",
  leverage: 3,
  collateralInput: "50",
  takeProfitInput: "",
  stopLossInput: "",
  slippageTolerance: 0.5,
  postOnly: false,
  reduceOnly: false,
  useAgentDelegation: true,
  selectedAgentStrategy: "Viper Momentum V2",

  setSide: (side) => set({ side }),
  setLeverage: (leverage) => set({ leverage }),
  setCollateralInput: (collateralInput) => set({ collateralInput }),
  setTakeProfitInput: (takeProfitInput) => set({ takeProfitInput }),
  setStopLossInput: (stopLossInput) => set({ stopLossInput }),
  setSlippageTolerance: (slippageTolerance) => set({ slippageTolerance }),
  setPostOnly: (postOnly) => set({ postOnly }),
  setReduceOnly: (reduceOnly) => set({ reduceOnly }),
  setUseAgentDelegation: (useAgentDelegation) => set({ useAgentDelegation }),
  setSelectedAgentStrategy: (selectedAgentStrategy) => set({ selectedAgentStrategy }),

  // Positions
  positions: [],
  closedPositionIds: [],
  addPosition: (pos) =>
    set((state) => ({
      positions: [pos, ...state.positions],
      closedPositionIds: state.closedPositionIds.filter(
        (cid) => cid !== pos.id && (!pos.positionKey || cid !== pos.positionKey)
      ),
    })),
  removePosition: (id) =>
    set((state) => {
      const target = state.positions.find((p) => p.id === id);
      const idsToAdd = [id];
      if (target?.positionKey) idsToAdd.push(target.positionKey);
      return {
        positions: state.positions.filter((p) => p.id !== id),
        closedPositionIds: Array.from(new Set([...state.closedPositionIds, ...idsToAdd])),
      };
    }),
  markPositionClosed: (id, positionKey) =>
    set((state) => {
      const idsToAdd = [id];
      if (positionKey) idsToAdd.push(positionKey);
      const matched = state.positions.find(
        (p) => p.id === id || (positionKey && p.positionKey === positionKey)
      );
      if (matched) {
        idsToAdd.push(matched.id);
        if (matched.positionKey) idsToAdd.push(matched.positionKey);
      }
      return {
        positions: state.positions.filter(
          (p) => p.id !== id && (!positionKey || p.positionKey !== positionKey)
        ),
        closedPositionIds: Array.from(new Set([...state.closedPositionIds, ...idsToAdd])),
      };
    }),
  unmarkPositionClosed: (id, positionKey) =>
    set((state) => ({
      closedPositionIds: state.closedPositionIds.filter(
        (cid) => cid !== id && (!positionKey || cid !== positionKey)
      ),
    })),
  updatePositionTpSl: (id, tp, sl) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, takeProfitPrice: tp, stopLossPrice: sl } : p
      ),
    })),
  syncPositionsMarkPrice: (symbol, currentMarkPrice) =>
    set((state) => ({
      positions: state.positions.map((pos) => {
        if (pos.market !== symbol) return pos;
        const currentPnlUsd = calcUnrealizedPnl(pos.side, pos.sizeUsd, pos.entryPrice, currentMarkPrice);
        const currentPnlPct = calcPnlPercentage(currentPnlUsd, pos.collateralUsd);
        return {
          ...pos,
          markPrice: currentMarkPrice,
          pnlUsd: currentPnlUsd,
          pnlPercent: currentPnlPct,
        };
      }),
    })),

  // Viral PnL Share Card Modal
  shareModalPosition: null,
  setShareModalPosition: (shareModalPosition) => set({ shareModalPosition }),

  // Tabs
  activeTab: "positions",
  setActiveTab: (activeTab) => set({ activeTab }),
}));
