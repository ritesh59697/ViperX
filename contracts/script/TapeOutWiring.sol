// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ITapeOutProcessor } from "../src/interfaces/ITapeOut.sol";
import { TapeOutCircuitGuardian } from "../src/core/TapeOutCircuitGuardian.sol";
import { ITapeOutCircuitGuardian } from "../src/interfaces/ITapeOutCircuitGuardian.sol";

/**
 * @notice Wires the four risk checks of a guardian to taped-out circuits named in env, and refuses to
 *         wire one whose on-chain netlist differs from its generated file in tapeout/circuits.
 *
 *         Per check (LEVERAGE, SLIPPAGE, DRAWDOWN, COOLDOWN):
 *           TAPEOUT_<CHECK>_CPU      processor holding the circuit (required)
 *           TAPEOUT_<CHECK>_ID       circuit id on that processor (required)
 *           TAPEOUT_<CHECK>_CIRCUIT  generated file name, without .json (default: see _defaultFile)
 *         TapeOutRiskCircuits.s.sol prints these after taping the circuits out.
 */
abstract contract TapeOutWiring is Script {
    string[4] internal CHECK_NAMES = ["LEVERAGE", "SLIPPAGE", "DRAWDOWN", "COOLDOWN"];
    string[4] internal DEFAULT_FILES = ["leverage_le", "slippage_le", "drawdown_le", "cooldown_ge"];

    function _circuitFile(uint256 i) internal view returns (string memory name, string memory json) {
        name = vm.envOr(string.concat("TAPEOUT_", CHECK_NAMES[i], "_CIRCUIT"), DEFAULT_FILES[i]);
        json = vm.readFile(string.concat("tapeout/circuits/", name, ".json"));
    }

    /// @notice The leverage circuit's ceiling (x100), read from its generated file.
    function _leverageCeiling() internal view returns (uint256) {
        (, string memory json) = _circuitFile(0);
        return vm.parseJsonUint(json, ".max");
    }

    /// @dev Must run inside the owner's broadcast: setCircuit is onlyOwner.
    function _wireFromEnv(TapeOutCircuitGuardian guardian) internal {
        for (uint256 i = 0; i < 4; i++) {
            address cpu = vm.envAddress(string.concat("TAPEOUT_", CHECK_NAMES[i], "_CPU"));
            uint256 id = vm.envUint(string.concat("TAPEOUT_", CHECK_NAMES[i], "_ID"));
            (string memory name, string memory json) = _circuitFile(i);
            require(
                keccak256(ITapeOutProcessor(cpu).netlist(id)) == keccak256(vm.parseJsonBytes(json, ".netlist")),
                string.concat(CHECK_NAMES[i], ": on-chain netlist differs from tapeout/circuits/", name, ".json")
            );
            guardian.setCircuit(ITapeOutCircuitGuardian.Check(i), cpu, id);
            console2.log(string.concat(CHECK_NAMES[i], " -> ", name, " id"), id);
        }
    }
}
