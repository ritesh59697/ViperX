// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IViperVault } from "../interfaces/IViperVault.sol";
import { PythPriceAdapter } from "./PythPriceAdapter.sol";

/**
 * @title ViperVault
 * @notice Core perpetual vault for ViperX on Base.
 * Liquidity Providers deposit USDC to mint vLP shares and act as counterparty to AI agents/traders.
 */
contract ViperVault is IViperVault, ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant PRECISION = 1e18;
    uint256 public constant TRADING_FEE_BPS = 10; // 0.10% (10 bps) fee on size
    uint256 public constant LIQUIDATION_FEE_BPS = 250; // 2.5% liquidation fee (half to liquidator, half to pool)
    uint256 public constant BASE_BORROW_RATE_PER_HOUR_BPS = 1; // 0.01% base borrow rate/hr

    IERC20 public immutable usdc;
    uint8 public immutable usdcDecimals;
    PythPriceAdapter public priceAdapter;

    uint256 public poolCollateralUsd;      // Total deposited USDC collateral (scaled to 1e18)
    uint256 public reservedPoolUsd;        // Pool capital reserved for open positions
    uint256 public cumulativeBorrowIndex;  // Accumulator for borrow interest
    uint256 public lastBorrowUpdateTime;   // Timestamp of last borrow index update

    mapping(bytes32 => MarketConfig) public markets;
    mapping(bytes32 => Position) public positions;
    mapping(address => bool) public isPositionRouter;

    error MarketNotActive();
    error MaxLeverageExceeded(uint256 requestedLeverageBps, uint256 maxLeverageBps);
    error InsufficientCollateral();
    error PositionNotFound();
    error Unauthorized();
    error PositionNotLiquidatable(uint256 remainingMarginUsd, uint256 maintenanceMarginUsd);
    error MaxOpenInterestExceeded();
    error InsufficientPoolLiquidity();
    error InvalidZeroAmount();

    constructor(
        address _usdc,
        uint8 _usdcDecimals,
        address _priceAdapter
    ) ERC20("ViperX LP Token", "vLP") Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        usdcDecimals = _usdcDecimals;
        priceAdapter = PythPriceAdapter(_priceAdapter);
        lastBorrowUpdateTime = block.timestamp;
        cumulativeBorrowIndex = PRECISION;
    }

    // =========================================================================
    // LP VAULT FUNCTIONS (ERC-4626 Style)
    // =========================================================================

    /**
     * @notice Deposit USDC to mint vLP tokens.
     * @param usdcAmount Amount of raw USDC to deposit.
     */
    function depositLiquidity(uint256 usdcAmount) external nonReentrant returns (uint256 sharesToMint) {
        if (usdcAmount == 0) revert InvalidZeroAmount();
        updateBorrowIndex();

        uint256 assetUsd18 = _toUsd18(usdcAmount);
        uint256 totalPoolAssets = totalAssets();

        if (totalSupply() == 0 || totalPoolAssets == 0) {
            sharesToMint = assetUsd18;
        } else {
            sharesToMint = (assetUsd18 * totalSupply()) / totalPoolAssets;
        }

        poolCollateralUsd += assetUsd18;
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        _mint(msg.sender, sharesToMint);

        emit LiquidityAdded(msg.sender, assetUsd18, sharesToMint);
    }

    /**
     * @notice Redeem vLP tokens for USDC.
     * @param shares Amount of vLP shares to burn.
     */
    function withdrawLiquidity(uint256 shares) external nonReentrant returns (uint256 usdcToReturn) {
        if (shares == 0) revert InvalidZeroAmount();
        updateBorrowIndex();

        uint256 totalPoolAssets = totalAssets();
        uint256 assetUsd18 = (shares * totalPoolAssets) / totalSupply();

        if (poolCollateralUsd < reservedPoolUsd + assetUsd18) revert InsufficientPoolLiquidity();

        poolCollateralUsd -= assetUsd18;
        _burn(msg.sender, shares);

        usdcToReturn = _fromUsd18(assetUsd18);
        usdc.safeTransfer(msg.sender, usdcToReturn);

        emit LiquidityRemoved(msg.sender, assetUsd18, shares);
    }

    /**
     * @notice Total NAV of the liquidity pool in 1e18 USD.
     */
    function totalAssets() public view returns (uint256) {
        return poolCollateralUsd;
    }

    // =========================================================================
    // POSITION TRADING FUNCTIONS
    // =========================================================================

    /**
     * @notice Opens a Long or Short position against the pool.
     */
    function openPosition(
        bytes32 marketId,
        PositionSide side,
        uint256 sizeUsd,
        uint256 collateralUsd
    ) external nonReentrant returns (bytes32 positionKey) {
        updateBorrowIndex();

        MarketConfig storage market = markets[marketId];
        if (!market.isActive) revert MarketNotActive();
        if (collateralUsd == 0 || sizeUsd < market.minPositionSizeUsd) revert InsufficientCollateral();

        uint256 leverageBps = (sizeUsd * BPS_DENOMINATOR) / collateralUsd;
        if (leverageBps > market.maxLeverageBps) revert MaxLeverageExceeded(leverageBps, market.maxLeverageBps);

        // Check Open Interest capacity
        if (side == PositionSide.LONG) {
            if (market.openInterestLongUsd + sizeUsd > market.maxOpenInterestLongUsd) revert MaxOpenInterestExceeded();
            market.openInterestLongUsd += sizeUsd;
        } else {
            if (market.openInterestShortUsd + sizeUsd > market.maxOpenInterestShortUsd) revert MaxOpenInterestExceeded();
            market.openInterestShortUsd += sizeUsd;
        }

        // Deduct opening fee from collateral
        uint256 openFeeUsd = (sizeUsd * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        if (collateralUsd <= openFeeUsd) revert InsufficientCollateral();
        uint256 netCollateral = collateralUsd - openFeeUsd;

        // Pull USDC collateral from trader
        uint256 rawUsdc = _fromUsd18(collateralUsd);
        usdc.safeTransferFrom(msg.sender, address(this), rawUsdc);
        poolCollateralUsd += openFeeUsd; // fee stays with pool LPs

        uint256 markPrice = priceAdapter.getNormalizedPrice(market.pythPriceFeedId);
        positionKey = getPositionKey(msg.sender, marketId, side);

        Position storage pos = positions[positionKey];
        if (pos.sizeUsd > 0) {
            // Add to existing position
            pos.entryPrice = (pos.entryPrice * pos.sizeUsd + markPrice * sizeUsd) / (pos.sizeUsd + sizeUsd);
            pos.sizeUsd += sizeUsd;
            pos.collateralUsd += netCollateral;
        } else {
            positions[positionKey] = Position({
                trader: msg.sender,
                marketId: marketId,
                side: side,
                sizeUsd: sizeUsd,
                collateralUsd: netCollateral,
                entryPrice: markPrice,
                entryBorrowIndex: cumulativeBorrowIndex,
                openedAt: block.timestamp
            });
        }

        emit PositionOpened(positionKey, msg.sender, marketId, side, sizeUsd, netCollateral, markPrice);
    }

    /**
     * @notice Closes a position, settles PnL against the pool, and returns remaining margin.
     */
    function closePosition(bytes32 positionKey) external nonReentrant returns (int256 realizedPnlUsd, uint256 payoutUsd) {
        updateBorrowIndex();

        Position memory pos = positions[positionKey];
        if (pos.sizeUsd == 0) revert PositionNotFound();
        if (pos.trader != msg.sender && !isPositionRouter[msg.sender]) revert Unauthorized();

        MarketConfig storage market = markets[pos.marketId];
        uint256 exitPrice = priceAdapter.getNormalizedPrice(market.pythPriceFeedId);

        // Calculate Gross PnL
        realizedPnlUsd = _calculatePnl(pos.side, pos.sizeUsd, pos.entryPrice, exitPrice);

        // Calculate Accrued Borrow Fee & Close Trading Fee
        uint256 borrowFeeUsd = _calculateBorrowFee(pos.sizeUsd, pos.entryBorrowIndex);
        uint256 closeFeeUsd = (pos.sizeUsd * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalDeductions = borrowFeeUsd + closeFeeUsd;

        poolCollateralUsd += totalDeductions; // fees accrued to pool

        if (realizedPnlUsd >= 0) {
            uint256 profit = uint256(realizedPnlUsd);
            payoutUsd = pos.collateralUsd + profit > totalDeductions ? (pos.collateralUsd + profit) - totalDeductions : 0;
            if (profit > 0) {
                if (poolCollateralUsd < profit) revert InsufficientPoolLiquidity();
                poolCollateralUsd -= profit;
            }
        } else {
            uint256 loss = uint256(-realizedPnlUsd);
            if (pos.collateralUsd > loss + totalDeductions) {
                payoutUsd = pos.collateralUsd - (loss + totalDeductions);
            } else {
                payoutUsd = 0;
            }
            poolCollateralUsd += (pos.collateralUsd - payoutUsd);
        }

        // Release Open Interest
        if (pos.side == PositionSide.LONG) {
            market.openInterestLongUsd -= pos.sizeUsd;
        } else {
            market.openInterestShortUsd -= pos.sizeUsd;
        }

        delete positions[positionKey];

        if (payoutUsd > 0) {
            uint256 rawPayoutUsdc = _fromUsd18(payoutUsd);
            usdc.safeTransfer(pos.trader, rawPayoutUsdc);
        }

        emit PositionClosed(positionKey, pos.trader, pos.marketId, pos.side, pos.sizeUsd, exitPrice, realizedPnlUsd, payoutUsd);
    }

    /**
     * @notice Liquidates an underwater position.
     */
    function liquidatePosition(bytes32 positionKey) external nonReentrant returns (uint256 liquidatorRewardUsd) {
        updateBorrowIndex();

        Position memory pos = positions[positionKey];
        if (pos.sizeUsd == 0) revert PositionNotFound();

        MarketConfig storage market = markets[pos.marketId];
        uint256 currentPrice = priceAdapter.getNormalizedPrice(market.pythPriceFeedId);

        int256 pnlUsd = _calculatePnl(pos.side, pos.sizeUsd, pos.entryPrice, currentPrice);
        uint256 borrowFeeUsd = _calculateBorrowFee(pos.sizeUsd, pos.entryBorrowIndex);

        int256 remainingMargin = int256(pos.collateralUsd) + pnlUsd - int256(borrowFeeUsd);
        uint256 maintenanceMarginUsd = (pos.sizeUsd * market.maintenanceMarginBps) / BPS_DENOMINATOR;

        if (remainingMargin > int256(maintenanceMarginUsd)) {
            revert PositionNotLiquidatable(remainingMargin > 0 ? uint256(remainingMargin) : 0, maintenanceMarginUsd);
        }

        // Liquidation Bounty for Keeper
        liquidatorRewardUsd = (pos.sizeUsd * LIQUIDATION_FEE_BPS) / BPS_DENOMINATOR / 2;
        if (liquidatorRewardUsd > pos.collateralUsd) liquidatorRewardUsd = pos.collateralUsd;

        // Release Open Interest
        if (pos.side == PositionSide.LONG) {
            market.openInterestLongUsd -= pos.sizeUsd;
        } else {
            market.openInterestShortUsd -= pos.sizeUsd;
        }

        delete positions[positionKey];

        if (liquidatorRewardUsd > 0) {
            usdc.safeTransfer(msg.sender, _fromUsd18(liquidatorRewardUsd));
        }

        emit PositionLiquidated(positionKey, pos.trader, msg.sender, pos.sizeUsd, currentPrice, liquidatorRewardUsd);
    }

    // =========================================================================
    // INTERNAL & VIEW HELPERS
    // =========================================================================

    function updateBorrowIndex() public {
        if (block.timestamp <= lastBorrowUpdateTime) return;
        uint256 hoursElapsed = (block.timestamp - lastBorrowUpdateTime) / 1 hours;
        if (hoursElapsed > 0) {
            uint256 rateBps = BASE_BORROW_RATE_PER_HOUR_BPS * hoursElapsed;
            cumulativeBorrowIndex += (cumulativeBorrowIndex * rateBps) / BPS_DENOMINATOR;
            lastBorrowUpdateTime = block.timestamp;
        }
    }

    function _calculateBorrowFee(uint256 sizeUsd, uint256 entryBorrowIndex) internal view returns (uint256) {
        if (cumulativeBorrowIndex <= entryBorrowIndex) return 0;
        return (sizeUsd * (cumulativeBorrowIndex - entryBorrowIndex)) / PRECISION;
    }

    function _calculatePnl(
        PositionSide side,
        uint256 sizeUsd,
        uint256 entryPrice,
        uint256 exitPrice
    ) internal pure returns (int256) {
        if (side == PositionSide.LONG) {
            return (int256(sizeUsd) * (int256(exitPrice) - int256(entryPrice))) / int256(entryPrice);
        } else {
            return (int256(sizeUsd) * (int256(entryPrice) - int256(exitPrice))) / int256(entryPrice);
        }
    }

    function getPositionKey(address trader, bytes32 marketId, PositionSide side) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(trader, marketId, side));
    }

    function _toUsd18(uint256 rawAmount) internal view returns (uint256) {
        if (usdcDecimals < 18) {
            return rawAmount * (10 ** (18 - usdcDecimals));
        } else {
            return rawAmount / (10 ** (usdcDecimals - 18));
        }
    }

    function _fromUsd18(uint256 usd18Amount) internal view returns (uint256) {
        if (usdcDecimals < 18) {
            return usd18Amount / (10 ** (18 - usdcDecimals));
        } else {
            return usd18Amount * (10 ** (usdcDecimals - 18));
        }
    }

    // =========================================================================
    // ADMIN CONFIGURATION
    // =========================================================================

    function addMarket(
        bytes32 marketId,
        bytes32 pythFeedId,
        uint256 maxOiLongUsd,
        uint256 maxOiShortUsd,
        uint256 minSizeUsd,
        uint256 maxLeverageBps,
        uint256 maintenanceMarginBps
    ) external onlyOwner {
        markets[marketId] = MarketConfig({
            isActive: true,
            pythPriceFeedId: pythFeedId,
            maxOpenInterestLongUsd: maxOiLongUsd,
            maxOpenInterestShortUsd: maxOiShortUsd,
            openInterestLongUsd: 0,
            openInterestShortUsd: 0,
            minPositionSizeUsd: minSizeUsd,
            maxLeverageBps: maxLeverageBps,
            maintenanceMarginBps: maintenanceMarginBps
        });
    }

    function setMarketActive(bytes32 marketId, bool isActive) external onlyOwner {
        markets[marketId].isActive = isActive;
    }

    function setPriceAdapter(address _priceAdapter) external onlyOwner {
        priceAdapter = PythPriceAdapter(_priceAdapter);
    }

    function setPositionRouter(address _router, bool _active) external onlyOwner {
        isPositionRouter[_router] = _active;
    }
}
