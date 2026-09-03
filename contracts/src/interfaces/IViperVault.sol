// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IViperVault {
    enum PositionSide { LONG, SHORT }

    struct Position {
        address trader;
        bytes32 marketId;
        PositionSide side;
        uint256 sizeUsd;          // 18 decimals
        uint256 collateralUsd;    // 18 decimals
        uint256 entryPrice;       // 18 decimals
        uint256 entryBorrowIndex; // cumulative borrow fee accumulator at open
        uint256 openedAt;
    }

    struct MarketConfig {
        bool isActive;
        bytes32 pythPriceFeedId;
        uint256 maxOpenInterestLongUsd;
        uint256 maxOpenInterestShortUsd;
        uint256 openInterestLongUsd;
        uint256 openInterestShortUsd;
        uint256 minPositionSizeUsd;
        uint256 maxLeverageBps;        // e.g. 50000 = 5x (5000 bps)
        uint256 maintenanceMarginBps; // e.g. 500 = 5%
    }

    event PositionOpened(
        bytes32 indexed positionKey,
        address indexed trader,
        bytes32 indexed marketId,
        PositionSide side,
        uint256 sizeUsd,
        uint256 collateralUsd,
        uint256 entryPrice
    );

    event PositionClosed(
        bytes32 indexed positionKey,
        address indexed trader,
        bytes32 indexed marketId,
        PositionSide side,
        uint256 sizeUsd,
        uint256 exitPrice,
        int256 realizedPnlUsd,
        uint256 netPayoutUsd
    );

    event PositionLiquidated(
        bytes32 indexed positionKey,
        address indexed trader,
        address indexed liquidator,
        uint256 sizeUsd,
        uint256 liquidationPrice,
        uint256 rewardUsd
    );

    event LiquidityAdded(address indexed lp, uint256 assets, uint256 shares);
    event LiquidityRemoved(address indexed lp, uint256 assets, uint256 shares);
}
