// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title TapeOutSignal
 * @notice Encodes an unsigned value as the input bytes of a TapeOut circuit (TAP-02 §5).
 * @dev The value is SATURATED to the circuit's width, never truncated. ViperX's risk circuits
 *      read 16-bit inputs, while the guardian computes uint32 signals; truncation would let a
 *      leverage of 65537 reach the circuit as 1 and pass. Saturating keeps every comparison
 *      exact as long as a ceiling sits below the all-ones input (the generator refuses any that
 *      does not) — a floor is exact for any threshold that fits.
 *
 *      Bit i of the value is circuit input i, packed least significant bit first: byte i / 8,
 *      bit i % 8. The width is read from the processor's `circuitInfo`, not assumed here.
 */
library TapeOutSignal {
    error WidthOutOfRange(uint256 nIn);

    /// @notice min(value, 2^nIn - 1).
    function saturate(uint256 value, uint256 nIn) internal pure returns (uint256) {
        if (nIn == 0 || nIn > 256) revert WidthOutOfRange(nIn);
        uint256 top = nIn == 256 ? type(uint256).max : (uint256(1) << nIn) - 1;
        return value > top ? top : value;
    }

    /// @notice The `inputs` argument for `processor.eval` of a circuit with nIn inputs.
    function encode(uint256 value, uint256 nIn) internal pure returns (bytes memory out) {
        uint256 v = saturate(value, nIn);
        uint256 len = (nIn + 7) / 8;
        out = new bytes(len);
        for (uint256 i = 0; i < len; ++i) {
            out[i] = bytes1(uint8(v >> (8 * i)));
        }
    }
}
