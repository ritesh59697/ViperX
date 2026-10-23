// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ITapeOutCircuitProcessor } from "../interfaces/ITapeOutCircuitProcessor.sol";

/**
 * @title MockTapeOutProcessor
 * @notice Simulates a TapeOut on-chain hardware circuit container on X Layer.
 *         Implements combinational digital logic gates:
 *         - COMP_0: Leverage Ratio <= maxLeverageRatio
 *         - COMP_1: Slippage Tolerance <= maxSlippageBps
 *         - COMP_2: Drawdown Tolerance <= maxDrawdownBps
 *         - COMP_3: Cooldown Latch >= minCooldownSeconds
 *         - AND_MASTER: All comparator outputs must be 1 (HIGH)
 */
contract MockTapeOutProcessor is ITapeOutCircuitProcessor {
    uint32 public constant DIAG_LEVERAGE_BREACH = 1 << 0;  // 0x01
    uint32 public constant DIAG_SLIPPAGE_BREACH = 1 << 1;  // 0x02
    uint32 public constant DIAG_DRAWDOWN_BREACH = 1 << 2;  // 0x04
    uint32 public constant DIAG_COOLDOWN_BREACH = 1 << 3;  // 0x08

    struct CircuitParameters {
        uint32 maxLeverageRatio;     // e.g. 2000 = 20.0x
        uint32 maxSlippageBps;       // e.g. 200 = 2.00%
        uint32 maxDrawdownBps;       // e.g. 2500 = 25.00%
        uint32 minCooldownSeconds;   // e.g. 10 = 10s anti-wash trading
        bool isRegistered;
    }

    mapping(uint256 => CircuitParameters) public circuits;

    event CircuitRegistered(
        uint256 indexed circuitId,
        uint32 maxLeverageRatio,
        uint32 maxSlippageBps,
        uint32 maxDrawdownBps,
        uint32 minCooldownSeconds
    );

    function registerCircuit(
        uint256 circuitId,
        uint32 maxLeverageRatio,
        uint32 maxSlippageBps,
        uint32 maxDrawdownBps,
        uint32 minCooldownSeconds
    ) external {
        circuits[circuitId] = CircuitParameters({
            maxLeverageRatio: maxLeverageRatio,
            maxSlippageBps: maxSlippageBps,
            maxDrawdownBps: maxDrawdownBps,
            minCooldownSeconds: minCooldownSeconds,
            isRegistered: true
        });

        emit CircuitRegistered(
            circuitId,
            maxLeverageRatio,
            maxSlippageBps,
            maxDrawdownBps,
            minCooldownSeconds
        );
    }

    function evaluateCircuit(
        uint256 circuitId,
        bytes32 inputBus
    ) external view override returns (bool passed, uint32 diagnosticBits) {
        CircuitParameters memory cfg = circuits[circuitId];
        require(cfg.isRegistered, "Circuit not registered");

        // Unpack the 256-bit input signal bus
        uint32 leverageRatio = uint32(uint256(inputBus));
        uint32 slippageBps = uint32(uint256(inputBus) >> 32);
        uint32 drawdownBps = uint32(uint256(inputBus) >> 64);
        uint32 cooldownSeconds = uint32(uint256(inputBus) >> 96);

        // Combinational Logic Gates (Comparators)
        if (leverageRatio > cfg.maxLeverageRatio) {
            diagnosticBits |= DIAG_LEVERAGE_BREACH;
        }
        if (slippageBps > cfg.maxSlippageBps) {
            diagnosticBits |= DIAG_SLIPPAGE_BREACH;
        }
        if (drawdownBps > cfg.maxDrawdownBps) {
            diagnosticBits |= DIAG_DRAWDOWN_BREACH;
        }
        if (cooldownSeconds < cfg.minCooldownSeconds) {
            diagnosticBits |= DIAG_COOLDOWN_BREACH;
        }

        // Master AND Gate: returns true if zero diagnostic violation bits
        passed = (diagnosticBits == 0);
    }
}
