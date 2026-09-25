// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import {MockPyth} from "../src/mocks/MockPyth.sol";
import {ViperVault} from "../src/core/ViperVault.sol";

contract AddRwaMarketsXLayer is Script {
    address constant VIPER_VAULT = 0x9Dcfe752AC97F167763FeD87f4100F33cD29dbb7;
    address constant MOCK_PYTH = 0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee;

    // RWA Pyth Feed IDs from frontend SUPPORTED_MARKETS
    bytes32 constant NVDA_FEED = 0x5a54e99f0e8f000efcead7818e6e9b8971d8ad2327663f73966035eb41cf6b48;
    bytes32 constant TSLA_FEED = 0x160934149021a0081d6d8db8618e5f8b9e67d4e41416e6378e906b38c2ef40a6;
    bytes32 constant COIN_FEED = 0x19d554a93a7e584feab5253805494d6e9f90cf9a3e20e8b15d2a9ff60e20f4f9;
    bytes32 constant SPY_FEED = 0x2613da66c6155551c682aa15259926a458b2914db368297f62939d37537b02ff;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=== Initializing RWA Markets (NVDA, TSLA, COIN, SPY) on OKX X Layer ===");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Seed Pyth Oracle Prices for RWAs
        MockPyth pyth = MockPyth(MOCK_PYTH);
        pyth.setPrice(NVDA_FEED, 119_56000000, -8, 1000000); // NVDA: $119.56
        console.log("MockPyth: set NVDA price to $119.56");

        pyth.setPrice(TSLA_FEED, 228_40000000, -8, 1000000); // TSLA: $228.40
        console.log("MockPyth: set TSLA price to $228.40");

        pyth.setPrice(COIN_FEED, 184_20000000, -8, 1000000); // COIN: $184.20
        console.log("MockPyth: set COIN price to $184.20");

        pyth.setPrice(SPY_FEED, 558_00000000, -8, 1000000);  // SPY: $558.00
        console.log("MockPyth: set SPY price to $558.00");

        // 2. Register Markets on ViperVault
        ViperVault vault = ViperVault(VIPER_VAULT);

        vault.addMarket(
            keccak256("NVDA-PERP"),
            NVDA_FEED,
            500_000 * 1e18,
            500_000 * 1e18,
            10 * 1e18,
            50000, // 5x max leverage
            500    // 5% maintenance margin
        );
        console.log("ViperVault: added NVDA-PERP market");

        vault.addMarket(
            keccak256("TSLA-PERP"),
            TSLA_FEED,
            500_000 * 1e18,
            500_000 * 1e18,
            10 * 1e18,
            50000,
            500
        );
        console.log("ViperVault: added TSLA-PERP market");

        vault.addMarket(
            keccak256("COIN-PERP"),
            COIN_FEED,
            500_000 * 1e18,
            500_000 * 1e18,
            10 * 1e18,
            50000,
            500
        );
        console.log("ViperVault: added COIN-PERP market");

        vault.addMarket(
            keccak256("SPY-PERP"),
            SPY_FEED,
            1_000_000 * 1e18,
            1_000_000 * 1e18,
            20 * 1e18,
            50000,
            500
        );
        console.log("ViperVault: added SPY-PERP market");

        vm.stopBroadcast();

        console.log("All RWA markets successfully initialized and active on ViperVault!");
    }
}
