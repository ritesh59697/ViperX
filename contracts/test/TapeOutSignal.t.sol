// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TapeOutSignal} from "../src/libraries/TapeOutSignal.sol";

contract TapeOutSignalHarness {
    function saturate(uint256 v, uint256 n) external pure returns (uint256) {
        return TapeOutSignal.saturate(v, n);
    }

    function encode(uint256 v, uint256 n) external pure returns (bytes memory) {
        return TapeOutSignal.encode(v, n);
    }
}

contract TapeOutSignalTest is Test {
    TapeOutSignalHarness h;

    function setUp() public {
        h = new TapeOutSignalHarness();
    }

    /// The bypass this library exists to stop: 65537 must not reach a 16-bit circuit as 1.
    function test_SaturatesInsteadOfTruncating() public view {
        assertEq(h.encode(65537, 16), hex"ffff");
        assertEq(h.encode(type(uint32).max, 16), hex"ffff");
        assertEq(h.encode(65535, 16), hex"ffff");
        assertEq(h.encode(2000, 16), hex"d007"); // matches tapeout/circuits/leverage_le.json
    }

    function test_RejectsBadWidth() public {
        vm.expectRevert(abi.encodeWithSelector(TapeOutSignal.WidthOutOfRange.selector, 0));
        h.encode(1, 0);
        vm.expectRevert(abi.encodeWithSelector(TapeOutSignal.WidthOutOfRange.selector, 257));
        h.encode(1, 257);
    }

    /// Bit i of the saturated value lands at byte i/8, bit i%8 (TAP-02 §5), and nothing else is set.
    function testFuzz_EncodeMatchesBitLayout(uint256 value, uint8 widthSeed) public view {
        uint256 nIn = bound(widthSeed, 1, 256);
        bytes memory out = h.encode(value, nIn);
        assertEq(out.length, (nIn + 7) / 8);
        uint256 v = h.saturate(value, nIn);
        for (uint256 i = 0; i < out.length * 8; ++i) {
            uint256 got = (uint8(out[i / 8]) >> (i % 8)) & 1;
            uint256 want = i < nIn ? (v >> i) & 1 : 0;
            assertEq(got, want);
        }
    }

    /// Saturation never changes a comparison against a ceiling below the all-ones input, or any floor.
    function testFuzz_SaturationPreservesComparisons(uint256 value, uint256 k, uint8 widthSeed) public view {
        uint256 nIn = bound(widthSeed, 1, 255);
        uint256 top = (uint256(1) << nIn) - 1;
        uint256 s = h.saturate(value, nIn);
        uint256 ceiling = bound(k, 0, top - 1);
        assertEq(s <= ceiling, value <= ceiling);
        uint256 floor_ = bound(k, 0, top);
        assertEq(s >= floor_, value >= floor_);
    }
}
