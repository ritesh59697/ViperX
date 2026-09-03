// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IViperVault } from "../interfaces/IViperVault.sol";
import { IPositionRouter } from "../interfaces/IPositionRouter.sol";
import { PythPriceAdapter } from "./PythPriceAdapter.sol";
import { ViperVault } from "./ViperVault.sol";

/**
 * @title PositionRouter
 * @notice Advanced order router for ViperX with EIP-712 signed agent delegation and Stop-Loss/Take-Profit triggers.
 */
contract PositionRouter is IPositionRouter, EIP712, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    bytes32 public constant AGENT_INTENT_TYPEHASH = keccak256(
        "AgentIntent(address agent,bytes32 marketId,uint8 side,uint256 sizeUsd,uint256 collateralUsd,uint256 maxSlippagePrice,uint256 deadline,uint256 nonce)"
    );

    ViperVault public immutable vault;
    IERC20 public immutable usdc;
    PythPriceAdapter public immutable priceAdapter;

    uint256 public minExecutionFeeUsd; // Execution reward for keeper executing trigger orders
    mapping(address => uint256) public agentNonces;
    mapping(bytes32 => TriggerOrder) public triggerOrders;

    error IntentExpired();
    error SlippageExceeded();
    error InvalidSignature();
    error OrderNotFound();
    error OrderNotTriggerable();
    error Unauthorized();

    constructor(
        address _vault,
        address _usdc,
        address _priceAdapter
    ) EIP712("ViperX PositionRouter", "1") Ownable(msg.sender) {
        vault = ViperVault(_vault);
        usdc = IERC20(_usdc);
        priceAdapter = PythPriceAdapter(_priceAdapter);
        minExecutionFeeUsd = 1 * 1e18; // $1.00 keeper bounty
    }

    // =========================================================================
    // EIP-712 DELEGATED AGENT EXECUTION
    // =========================================================================

    /**
     * @notice Allows an off-chain keeper or backend runtime to execute a trade signed by an autonomous AI agent.
     */
    function executeAgentIntent(
        AgentIntent calldata intent,
        bytes calldata signature
    ) external nonReentrant returns (bytes32 positionKey) {
        if (block.timestamp > intent.deadline) revert IntentExpired();
        if (intent.nonce != agentNonces[intent.agent]++) revert Unauthorized();

        // 1. Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                AGENT_INTENT_TYPEHASH,
                intent.agent,
                intent.marketId,
                uint8(intent.side),
                intent.sizeUsd,
                intent.collateralUsd,
                intent.maxSlippagePrice,
                intent.deadline,
                intent.nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != intent.agent) revert InvalidSignature();

        // 2. Validate Mark Price against agent's slippage limit
        (,bytes32 pythFeedId,,,,,,,) = vault.markets(intent.marketId);
        uint256 markPrice = priceAdapter.getNormalizedPrice(pythFeedId);

        if (intent.side == IViperVault.PositionSide.LONG) {
            if (markPrice > intent.maxSlippagePrice) revert SlippageExceeded();
        } else {
            if (markPrice < intent.maxSlippagePrice) revert SlippageExceeded();
        }

        // 3. Transfer USDC from agent to this router, approve vault, and open position
        uint256 rawUsdc = _fromUsd18(intent.collateralUsd);
        usdc.safeTransferFrom(intent.agent, address(this), rawUsdc);
        usdc.forceApprove(address(vault), rawUsdc);

        positionKey = vault.openPosition(
            intent.marketId,
            intent.side,
            intent.sizeUsd,
            intent.collateralUsd
        );
    }

    // =========================================================================
    // STOP-LOSS & TAKE-PROFIT TRIGGERS
    // =========================================================================

    /**
     * @notice Registers an on-chain Stop-Loss or Take-Profit limit order.
     */
    function createTriggerOrder(
        bytes32 marketId,
        IViperVault.PositionSide side,
        OrderType orderType,
        uint256 triggerPriceUsd,
        uint256 sizeUsd,
        uint256 collateralUsd,
        bool isExecution
    ) external nonReentrant returns (bytes32 orderId) {
        orderId = keccak256(
            abi.encodePacked(
                msg.sender,
                marketId,
                side,
                triggerPriceUsd,
                block.timestamp
            )
        );

        triggerOrders[orderId] = TriggerOrder({
            orderId: orderId,
            trader: msg.sender,
            marketId: marketId,
            side: side,
            triggerPriceUsd: triggerPriceUsd,
            sizeUsd: sizeUsd,
            collateralUsd: collateralUsd,
            orderType: orderType,
            isExecution: isExecution,
            isActive: true,
            createdAt: block.timestamp
        });

        emit TriggerOrderCreated(orderId, msg.sender, marketId, orderType, triggerPriceUsd, sizeUsd);
    }

    /**
     * @notice Executes a triggered Stop-Loss or Take-Profit order when oracle price reaches the threshold.
     */
    function executeTriggerOrder(bytes32 orderId) external nonReentrant {
        TriggerOrder storage order = triggerOrders[orderId];
        if (!order.isActive) revert OrderNotFound();

        (,bytes32 pythFeedId,,,,,,,) = vault.markets(order.marketId);
        uint256 markPrice = priceAdapter.getNormalizedPrice(pythFeedId);

        bool isTriggered = false;
        if (order.orderType == OrderType.TAKE_PROFIT) {
            if (order.side == IViperVault.PositionSide.LONG) {
                isTriggered = markPrice >= order.triggerPriceUsd;
            } else {
                isTriggered = markPrice <= order.triggerPriceUsd;
            }
        } else if (order.orderType == OrderType.STOP_LOSS) {
            if (order.side == IViperVault.PositionSide.LONG) {
                isTriggered = markPrice <= order.triggerPriceUsd;
            } else {
                isTriggered = markPrice >= order.triggerPriceUsd;
            }
        }

        if (!isTriggered) revert OrderNotTriggerable();
        order.isActive = false;

        // If it's a position close trigger, execute close on vault
        if (order.isExecution) {
            bytes32 positionKey = vault.getPositionKey(order.trader, order.marketId, order.side);
            vault.closePosition(positionKey);
        }

        emit TriggerOrderExecuted(orderId, msg.sender, markPrice);
    }

    /**
     * @notice Cancels an active trigger order.
     */
    function cancelTriggerOrder(bytes32 orderId) external {
        TriggerOrder storage order = triggerOrders[orderId];
        if (order.trader != msg.sender) revert Unauthorized();
        if (!order.isActive) revert OrderNotFound();

        order.isActive = false;
        emit TriggerOrderCancelled(orderId);
    }

    function _fromUsd18(uint256 usd18Amount) internal view returns (uint256) {
        uint8 decimals = vault.usdcDecimals();
        if (decimals < 18) {
            return usd18Amount / (10 ** (18 - decimals));
        } else {
            return usd18Amount * (10 ** (decimals - 18));
        }
    }
}
