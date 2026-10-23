// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ITapeOutCircuitProcessor
 * @notice Standard interface for TapeOut on-chain circuit processor containers on X Layer.
 *         TapeOut enables digital logic gates (NAND, COMPARATOR, LATCH, AND gates)
 *         to execute deterministically on-chain as hardware-grade microprocessors.
 */
interface ITapeOutCircuitProcessor {
    /**
     * @notice Evaluates a digital logic circuit container with packed input signals.
     * @param circuitId The unique identifier of the registered TapeOut circuit.
     * @param inputBus 256-bit packed signal bus containing normalized trade metrics.
     * @return passed Boolean indicating if the master output is high (true = safe / approved).
     * @return diagnosticBits Bitfield pinpointing which logic comparator failed (if any).
     */
    function evaluateCircuit(
        uint256 circuitId,
        bytes32 inputBus
    ) external view returns (bool passed, uint32 diagnosticBits);
}
