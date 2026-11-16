// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPositionRouter } from "./IPositionRouter.sol";

/**
 * @title ITapeOutCircuitGuardian
 * @notice Risk gate between ViperX trade paths (PositionRouter, ViperVault) and TapeOut circuits.
 *         Each of the four checks is a real TapeOut circuit, evaluated with `processor.eval`.
 */
interface ITapeOutCircuitGuardian {
    /// @notice The four risk checks. A failed check sets diagnostic bit `1 << uint8(check)`.
    enum Check {
        LEVERAGE, // leverage x100 <= ceiling
        SLIPPAGE, // slippage bps  <= ceiling
        DRAWDOWN, // drawdown bps  <= ceiling
        COOLDOWN // seconds since the agent's last trade >= floor
    }

    event CircuitEvaluated(address indexed agent, bool passed, uint32 diagnosticBits, bytes32 inputBus);
    event CircuitSet(Check indexed check, address indexed processor, uint256 indexed circuitId, uint32 nIn);
    event CircuitCleared(Check indexed check);

    function validateIntent(IPositionRouter.AgentIntent calldata intent, uint256 markPrice)
        external
        returns (bool passed, uint32 diagnosticBits, bytes32 inputBus);

    function recordExecution(address agent) external;

    function packSignals(uint32 leverageRatio, uint32 slippageBps, uint32 drawdownBps, uint32 cooldownSeconds)
        external
        pure
        returns (bytes32 inputBus);
}
