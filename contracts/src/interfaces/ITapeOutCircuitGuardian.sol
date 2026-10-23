// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPositionRouter } from "./IPositionRouter.sol";

/**
 * @title ITapeOutCircuitGuardian
 * @notice Interface for the TapeOut Circuit Guardian adapter connecting PositionRouter to TapeOut circuits.
 */
interface ITapeOutCircuitGuardian {
    event CircuitEvaluated(
        address indexed agent,
        uint256 indexed circuitId,
        bool passed,
        uint32 diagnosticBits,
        bytes32 inputBus
    );

    event CircuitConfigUpdated(
        address indexed processor,
        uint256 indexed circuitId
    );

    function validateIntent(
        IPositionRouter.AgentIntent calldata intent,
        uint256 markPrice
    ) external returns (bool passed, uint32 diagnosticBits, bytes32 inputBus);

    function recordExecution(address agent) external;

    function packSignals(
        uint32 leverageRatio,
        uint32 slippageBps,
        uint32 drawdownBps,
        uint32 cooldownSeconds
    ) external pure returns (bytes32 inputBus);
}
