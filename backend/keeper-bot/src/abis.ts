export const ViperVaultAbi = [
  {
    type: "function",
    name: "updateBorrowIndex",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "liquidatePosition",
    inputs: [{ name: "positionKey", type: "bytes32" }],
    outputs: [{ name: "liquidatorRewardUsd", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "positions",
    inputs: [{ name: "positionKey", type: "bytes32" }],
    outputs: [
      { name: "trader", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "side", type: "uint8" },
      { name: "sizeUsd", type: "uint256" },
      { name: "collateralUsd", type: "uint256" },
      { name: "entryPrice", type: "uint256" },
      { name: "entryBorrowIndex", type: "uint256" },
      { name: "openedAt", type: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "PositionOpened",
    inputs: [
      { name: "positionKey", type: "bytes32", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "side", type: "uint8", indexed: false },
      { name: "sizeUsd", type: "uint256", indexed: false },
      { name: "collateralUsd", type: "uint256", indexed: false },
      { name: "entryPrice", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "PositionClosed",
    inputs: [
      { name: "positionKey", type: "bytes32", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "marketId", type: "bytes32", indexed: true }
    ]
  }
] as const;

export const PositionRouterAbi = [
  {
    type: "function",
    name: "executeTriggerOrder",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "TriggerOrderCreated",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "orderType", type: "uint8", indexed: false },
      { name: "triggerPriceUsd", type: "uint256", indexed: false },
      { name: "sizeUsd", type: "uint256", indexed: false }
    ]
  }
] as const;
