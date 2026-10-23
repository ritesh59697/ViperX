// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { PositionRouter } from "../src/core/PositionRouter.sol";
import { TapeOutCircuitGuardian } from "../src/core/TapeOutCircuitGuardian.sol";
import { MockTapeOutProcessor } from "../src/mocks/MockTapeOutProcessor.sol";

/**
 * @title DeployTapeOutGuardianXLayer
 * @notice Deploys and connects the TapeOut Circuit Guardian to PositionRouter on OKX X Layer.
 */
contract DeployTapeOutGuardianXLayer is Script {
    uint256 public constant CIRCUIT_VIPERX_RISK = 101;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address routerAddress = vm.envOr("POSITION_ROUTER_ADDRESS", 0x36B9e0D1b0702FC59114A87f277b836d482EaF6A);
        address processorAddress = vm.envOr("TAPEOUT_PROCESSOR_ADDRESS", address(0));

        console2.log("==================================================");
        console2.log("Deploying TapeOut Circuit Guardian on X Layer");
        console2.log("Deployer:", deployer);
        console2.log("Target PositionRouter:", routerAddress);
        console2.log("==================================================");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Resolve or Deploy TapeOut Processor
        MockTapeOutProcessor processor;
        if (processorAddress == address(0)) {
            processor = new MockTapeOutProcessor();
            processorAddress = address(processor);
            console2.log("Deployed TapeOut Processor at:", processorAddress);

            // Register default ViperX Risk Circuit
            processor.registerCircuit({
                circuitId: CIRCUIT_VIPERX_RISK,
                maxLeverageRatio: 2000,     // 20.0x max leverage
                maxSlippageBps: 200,        // 2.00% max slippage tolerance
                maxDrawdownBps: 2500,       // 25.00% max drawdown limit
                minCooldownSeconds: 10      // 10s anti-wash trading latch
            });
            console2.log("Registered Circuit ID:", CIRCUIT_VIPERX_RISK);
        } else {
            console2.log("Using existing TapeOut Processor at:", processorAddress);
        }

        // 2. Deploy TapeOut Circuit Guardian Adapter
        TapeOutCircuitGuardian guardian = new TapeOutCircuitGuardian(
            processorAddress,
            CIRCUIT_VIPERX_RISK,
            routerAddress
        );
        console2.log("TapeOut Circuit Guardian deployed at:", address(guardian));

        // 3. Connect Guardian to PositionRouter (if deployer owns router)
        PositionRouter router = PositionRouter(routerAddress);
        try router.setCircuitGuardian(address(guardian)) {
            console2.log("Successfully connected Guardian to PositionRouter!");
        } catch {
            console2.log("Notice: Set Guardian manually if deployer is not router owner.");
        }

        vm.stopBroadcast();
        console2.log("==================================================");
        console2.log("Deployment Complete!");
        console2.log("==================================================");
    }
}
