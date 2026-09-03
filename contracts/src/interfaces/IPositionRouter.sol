// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IViperVault } from "./IViperVault.sol";

interface IPositionRouter {
    enum OrderType { MARKET, STOP_LOSS, TAKE_PROFIT }

    struct TriggerOrder {
        bytes32 orderId;
        address trader;
        bytes32 marketId;
        IViperVault.PositionSide side;
        uint256 triggerPriceUsd; // 18 decimals
        uint256 sizeUsd;
        uint256 collateralUsd;
        OrderType orderType;
        bool isExecution;       // true = close position, false = open position
        bool isActive;
        uint256 createdAt;
    }

    struct AgentIntent {
        address agent;
        bytes32 marketId;
        IViperVault.PositionSide side;
        uint256 sizeUsd;
        uint256 collateralUsd;
        uint256 maxSlippagePrice;
        uint256 deadline;
        uint256 nonce;
    }

    event TriggerOrderCreated(
        bytes32 indexed orderId,
        address indexed trader,
        bytes32 indexed marketId,
        OrderType orderType,
        uint256 triggerPriceUsd,
        uint256 sizeUsd
    );

    event TriggerOrderExecuted(
        bytes32 indexed orderId,
        address indexed executor,
        uint256 executionPriceUsd
    );

    event TriggerOrderCancelled(bytes32 indexed orderId);
}
