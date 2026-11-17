// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { Registry } from "../src/registry/Registry.sol";

/**
 * @title DeployAgentRegistryXLayer
 * @notice Deploys the ViperX agent registry that /create writes to. The registry has no owner and
 *         no constructor arguments: anyone registers their own agents, and only an agent's owner
 *         can change its status or metadata.
 *
 *         Signing: --account <name> --sender <addr> (keystore), or PRIVATE_KEY in env.
 *         Prints the NEXT_PUBLIC_XLAYER_AGENT_REGISTRY line the frontend reads.
 */
contract DeployAgentRegistryXLayer is Script {
    function run() external returns (Registry registry) {
        uint256 key = vm.envOr("PRIVATE_KEY", uint256(0));
        if (key == 0) vm.startBroadcast();
        else vm.startBroadcast(key);

        registry = new Registry();

        vm.stopBroadcast();

        require(address(registry).code.length > 0, "registry: no code after deploy");
        console2.log("NEXT_PUBLIC_XLAYER_AGENT_REGISTRY=", address(registry));
    }
}
