// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MockTapeOutFactory, MockTapeOutProcessor } from "../../src/mocks/MockTapeOut.sol";
import { TapeOutCircuitGuardian } from "../../src/core/TapeOutCircuitGuardian.sol";
import { ITapeOutCircuitGuardian } from "../../src/interfaces/ITapeOutCircuitGuardian.sol";

/**
 * @notice Tapes the generated netlists (tapeout/circuits) out to an offline TAP-02 processor and wires
 *         them into a guardian. Every netlist's stored test vectors are replayed first, so a test only
 *         runs against circuits the mock evaluates exactly as the TapeOut reference does.
 */
abstract contract TapeOutCircuitFixture is Test {
    MockTapeOutFactory internal tapeoutFactory;
    MockTapeOutProcessor internal tapeoutCpu;

    function _deployTapeOut() internal {
        tapeoutFactory = new MockTapeOutFactory();
        tapeoutCpu = tapeoutFactory.createCPU();
    }

    /// @param path Relative to tapeout/circuits, without ".json" (e.g. "leverage_le", "fixtures/slippage_le_0").
    function _tapeoutCircuit(string memory path) internal returns (uint256 id) {
        string memory json = vm.readFile(string.concat("tapeout/circuits/", path, ".json"));
        id = tapeoutCpu.tapeout(
            vm.parseJsonBytes(json, ".netlist"),
            uint32(vm.parseJsonUint(json, ".nIn")),
            uint32(vm.parseJsonUint(json, ".nOut"))
        );
        bytes[] memory ins = vm.parseJsonBytesArray(json, ".inputs");
        bytes[] memory outs = vm.parseJsonBytesArray(json, ".outputs");
        for (uint256 i = 0; i < ins.length; i++) {
            assertEq(tapeoutCpu.eval(id, ins[i]), outs[i], string.concat(path, " vector ", vm.toString(i)));
        }
    }

    function _wire(TapeOutCircuitGuardian guardian, string memory lev, string memory slip, string memory dd, string memory cool)
        internal
    {
        guardian.setCircuit(ITapeOutCircuitGuardian.Check.LEVERAGE, address(tapeoutCpu), _tapeoutCircuit(lev));
        guardian.setCircuit(ITapeOutCircuitGuardian.Check.SLIPPAGE, address(tapeoutCpu), _tapeoutCircuit(slip));
        guardian.setCircuit(ITapeOutCircuitGuardian.Check.DRAWDOWN, address(tapeoutCpu), _tapeoutCircuit(dd));
        guardian.setCircuit(ITapeOutCircuitGuardian.Check.COOLDOWN, address(tapeoutCpu), _tapeoutCircuit(cool));
    }
}
