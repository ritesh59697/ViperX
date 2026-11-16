// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MockTapeOutFactory / MockTapeOutProcessor
 * @notice Offline stand-ins for the TapeOut factory and processor, for unit tests only.
 *         The processor really evaluates TAP-02 netlists — NAND elements only, combinational — so
 *         tests run the same netlists (tapeout/circuits/*.json) that the mainnet fork test tapes out
 *         to the real processor. It charges no fees and mints no gates; the fork test covers those.
 */
contract MockTapeOutFactory {
    mapping(address => bool) public isCPU;

    function createCPU() external returns (MockTapeOutProcessor cpu) {
        cpu = new MockTapeOutProcessor();
        isCPU[address(cpu)] = true;
    }
}

contract MockTapeOutProcessor {
    struct Stored {
        bytes netlist;
        uint32 nIn;
        uint32 nOut;
        uint32 gateCount;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Stored) internal _circuits;

    error NotNandOnly(uint256 offset);
    error IllFormed(uint256 offset);
    error UnknownCircuit(uint256 id);

    /// @notice Stores a NAND-only netlist after the TAP-02 §3 checks that apply to it.
    function tapeout(bytes calldata nl, uint32 nIn, uint32 nOut) external payable returns (uint256 id) {
        if (nl.length == 0 || nl.length % 7 != 0) revert IllFormed(nl.length);
        uint256 n = nl.length / 7;
        for (uint256 e = 0; e < n; ++e) {
            uint256 p = e * 7;
            if (uint8(nl[p]) != 0x00) revert NotNandOnly(p);
            uint256 self = 2 + nIn + e;
            if (_u24(nl, p + 1) >= self || _u24(nl, p + 4) >= self) revert IllFormed(p);
        }
        if (nOut == 0 || nOut > n) revert IllFormed(0);
        id = nextId++;
        _circuits[id] = Stored(nl, nIn, nOut, uint32(n));
    }

    function circuitInfo(uint256 id) external view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount) {
        Stored storage c = _circuits[id];
        if (c.gateCount == 0) revert UnknownCircuit(id);
        return (c.nIn, c.nOut, 0, c.gateCount);
    }

    function netlist(uint256 id) external view returns (bytes memory) {
        return _circuits[id].netlist;
    }

    /// @notice One beat (TAP-02 §4): inputs LSB-first, outputs are the last nOut signals, packed LSB-first.
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory out) {
        Stored storage c = _circuits[id];
        if (c.gateCount == 0) revert UnknownCircuit(id);
        bytes memory nl = c.netlist;
        uint256 nSig = 2 + c.nIn + c.gateCount;
        bool[] memory a = new bool[](nSig);
        a[1] = true;
        for (uint256 i = 0; i < c.nIn; ++i) {
            a[2 + i] = (i >> 3) < inputs.length && (uint8(inputs[i >> 3]) >> (i & 7)) & 1 == 1;
        }
        for (uint256 e = 0; e < c.gateCount; ++e) {
            uint256 p = e * 7;
            a[2 + c.nIn + e] = !(a[_u24m(nl, p + 1)] && a[_u24m(nl, p + 4)]);
        }
        out = new bytes((c.nOut + 7) / 8);
        for (uint256 k = 0; k < c.nOut; ++k) {
            if (a[nSig - c.nOut + k]) out[k >> 3] = bytes1(uint8(out[k >> 3]) | uint8(1 << (k & 7)));
        }
    }

    function _u24(bytes calldata b, uint256 p) private pure returns (uint256) {
        return (uint256(uint8(b[p])) << 16) | (uint256(uint8(b[p + 1])) << 8) | uint256(uint8(b[p + 2]));
    }

    function _u24m(bytes memory b, uint256 p) private pure returns (uint256) {
        return (uint256(uint8(b[p])) << 16) | (uint256(uint8(b[p + 1])) << 8) | uint256(uint8(b[p + 2]));
    }
}
