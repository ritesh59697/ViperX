// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { console2 } from "forge-std/Script.sol";
import { PositionRouter } from "../src/core/PositionRouter.sol";
import { TapeOutCircuitGuardian } from "../src/core/TapeOutCircuitGuardian.sol";
import { TapeOutWiring } from "./TapeOutWiring.sol";

/**
 * @title DeployTapeOutGuardianXLayer
 * @notice Deploys a guardian on the four taped-out risk circuits and connects it to an existing
 *         PositionRouter. X Layer mainnet only (where the TapeOut factory is).
 *
 *         Signing: --account <name> --sender <addr> (keystore), or PRIVATE_KEY in env.
 *         Required env: TAPEOUT_FACTORY_XLAYER, POSITION_ROUTER_ADDRESS, TAPEOUT_<CHECK>_CPU / _ID.
 *         Optional env: VIPER_VAULT_ADDRESS — authorized on the guardian so direct vault trades are gated.
 */
contract DeployTapeOutGuardianXLayer is TapeOutWiring {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address routerAddress = vm.envAddress("POSITION_ROUTER_ADDRESS");
        address vaultAddress = vm.envOr("VIPER_VAULT_ADDRESS", address(0));
        address factory = vm.envAddress("TAPEOUT_FACTORY_XLAYER");

        if (deployerPrivateKey == 0) vm.startBroadcast();
        else vm.startBroadcast(deployerPrivateKey);

        TapeOutCircuitGuardian guardian = new TapeOutCircuitGuardian(factory, routerAddress);
        console2.log("TapeOutCircuitGuardian:", address(guardian));
        _wireFromEnv(guardian);
        if (vaultAddress != address(0)) guardian.setAuthorizedCaller(vaultAddress, true);

        try PositionRouter(routerAddress).setCircuitGuardian(address(guardian)) {
            console2.log("Connected to PositionRouter", routerAddress);
        } catch {
            console2.log("Signer is not the router owner: call router.setCircuitGuardian manually.");
        }
        vm.stopBroadcast();

        require(guardian.configuredCount() == guardian.CHECK_COUNT(), "guardian circuits not all set");
    }
}
