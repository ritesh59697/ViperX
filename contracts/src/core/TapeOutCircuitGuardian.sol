// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ITapeOutCircuitProcessor } from "../interfaces/ITapeOutCircuitProcessor.sol";
import { ITapeOutCircuitGuardian } from "../interfaces/ITapeOutCircuitGuardian.sol";
import { IPositionRouter } from "../interfaces/IPositionRouter.sol";
import { IViperVault } from "../interfaces/IViperVault.sol";

/**
 * @title TapeOutCircuitGuardian
 * @notice Adapts trade intent data from ViperX PositionRouter to TapeOut digital logic circuit containers on X Layer.
 *         Normalizes leverage, slippage bounds, historic drawdown, and execution cooldown into a 256-bit signal bus.
 */
contract TapeOutCircuitGuardian is ITapeOutCircuitGuardian, Ownable {
    ITapeOutCircuitProcessor public processor;
    uint256 public circuitId;
    address public positionRouter;

    mapping(address => uint256) public lastTradeTime;
    mapping(address => uint32) public agentDrawdownBps;

    error Unauthorized();
    error InvalidProcessor();

    modifier onlyRouterOrOwner() {
        if (msg.sender != positionRouter && msg.sender != owner()) revert Unauthorized();
        _;
    }

    constructor(
        address _processor,
        uint256 _circuitId,
        address _positionRouter
    ) Ownable(msg.sender) {
        if (_processor != address(0)) {
            processor = ITapeOutCircuitProcessor(_processor);
        }
        circuitId = _circuitId;
        positionRouter = _positionRouter;
    }

    function setProcessor(address _processor, uint256 _circuitId) external onlyOwner {
        if (_processor == address(0)) revert InvalidProcessor();
        processor = ITapeOutCircuitProcessor(_processor);
        circuitId = _circuitId;
        emit CircuitConfigUpdated(_processor, _circuitId);
    }

    function setPositionRouter(address _positionRouter) external onlyOwner {
        positionRouter = _positionRouter;
    }

    function setAgentDrawdown(address agent, uint32 drawdownBps) external onlyRouterOrOwner {
        agentDrawdownBps[agent] = drawdownBps;
    }

    /**
     * @notice Packs normalized trade metrics into a single 256-bit bus for TapeOut circuit processing.
     */
    function packSignals(
        uint32 leverageRatio,
        uint32 slippageBps,
        uint32 drawdownBps,
        uint32 cooldownSeconds
    ) public pure override returns (bytes32 inputBus) {
        uint256 packed = uint256(leverageRatio)
            | (uint256(slippageBps) << 32)
            | (uint256(drawdownBps) << 64)
            | (uint256(cooldownSeconds) << 96);
        return bytes32(packed);
    }

    /**
     * @notice Evaluates an agent's signed order intent against the active TapeOut circuit on X Layer.
     */
    function validateIntent(
        IPositionRouter.AgentIntent calldata intent,
        uint256 markPrice
    ) external override onlyRouterOrOwner returns (bool passed, uint32 diagnosticBits, bytes32 inputBus) {
        if (address(processor) == address(0)) {
            return (true, 0, bytes32(0));
        }

        // 1. Calculate Leverage Ratio (scaled by 100, e.g. 10.0x = 1000)
        uint32 leverageRatio = 0;
        if (intent.collateralUsd > 0) {
            leverageRatio = uint32((intent.sizeUsd * 100) / intent.collateralUsd);
        }

        // 2. Calculate Slippage Tolerance in Basis Points
        uint32 slippageBps = 0;
        if (markPrice > 0) {
            uint256 diff = 0;
            if (intent.side == IViperVault.PositionSide.LONG) {
                if (intent.maxSlippagePrice > markPrice) {
                    diff = intent.maxSlippagePrice - markPrice;
                }
            } else {
                if (markPrice > intent.maxSlippagePrice) {
                    diff = markPrice - intent.maxSlippagePrice;
                }
            }
            slippageBps = uint32((diff * 10000) / markPrice);
        }

        // 3. Drawdown in Basis Points
        uint32 drawdownBps = agentDrawdownBps[intent.agent];

        // 4. Cooldown Time since last verified trade (seconds)
        uint256 lastTime = lastTradeTime[intent.agent];
        uint32 cooldownSeconds = (lastTime == 0)
            ? type(uint32).max
            : uint32(block.timestamp - lastTime);

        // Pack the input signal bus
        inputBus = packSignals(leverageRatio, slippageBps, drawdownBps, cooldownSeconds);

        // Execute on TapeOut circuit processor
        (passed, diagnosticBits) = processor.evaluateCircuit(circuitId, inputBus);

        emit CircuitEvaluated(intent.agent, circuitId, passed, diagnosticBits, inputBus);
    }

    /**
     * @notice Records a successful trade execution timestamp for cooldown tracking.
     */
    function recordExecution(address agent) external override onlyRouterOrOwner {
        lastTradeTime[agent] = block.timestamp;
    }
}
