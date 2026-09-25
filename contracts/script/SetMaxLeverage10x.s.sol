// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import {ViperVault} from "../src/core/ViperVault.sol";

contract SetMaxLeverage10x is Script {
    address constant VIPER_VAULT = 0x9Dcfe752AC97F167763FeD87f4100F33cD29dbb7;

    bytes32 constant ETH_USD_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 constant BTC_USD_FEED = 0xe62df6e875746b43f8000b0b152753545192ddc4203240d23e1112c0200ecd92;
    bytes32 constant SOL_USD_FEED = 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d;
    bytes32 constant OKB_USD_FEED = keccak256("OKB-USD-FEED");

    bytes32 constant NVDA_FEED = 0x5a54e99f0e8f000efcead7818e6e9b8971d8ad2327663f73966035eb41cf6b48;
    bytes32 constant TSLA_FEED = 0x160934149021a0081d6d8db8618e5f8b9e67d4e41416e6378e906b38c2ef40a6;
    bytes32 constant COIN_FEED = 0x19d554a93a7e584feab5253805494d6e9f90cf9a3e20e8b15d2a9ff60e20f4f9;
    bytes32 constant SPY_FEED = 0x2613da66c6155551c682aa15259926a458b2914db368297f62939d37537b02ff;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=== Upgrading All ViperVault Markets to 10x Max Leverage (100,000 bps) ===");

        vm.startBroadcast(deployerPrivateKey);

        ViperVault vault = ViperVault(VIPER_VAULT);

        // Crypto Markets - 10x leverage (100000 bps)
        vault.addMarket(keccak256("ETH-PERP"), ETH_USD_FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 10 * 1e18, 100000, 500);
        console.log("Updated ETH-PERP to 10x max leverage");

        vault.addMarket(keccak256("BTC-PERP"), BTC_USD_FEED, 2_000_000 * 1e18, 2_000_000 * 1e18, 20 * 1e18, 100000, 500);
        console.log("Updated BTC-PERP to 10x max leverage");

        vault.addMarket(keccak256("SOL-PERP"), SOL_USD_FEED, 500_000 * 1e18, 500_000 * 1e18, 5 * 1e18, 100000, 500);
        console.log("Updated SOL-PERP to 10x max leverage");

        vault.addMarket(keccak256("OKB-PERP"), OKB_USD_FEED, 500_000 * 1e18, 500_000 * 1e18, 5 * 1e18, 100000, 500);
        console.log("Updated OKB-PERP to 10x max leverage");

        // RWA Markets - 10x leverage (100000 bps)
        vault.addMarket(keccak256("NVDA-PERP"), NVDA_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, 100000, 500);
        console.log("Updated NVDA-PERP to 10x max leverage");

        vault.addMarket(keccak256("TSLA-PERP"), TSLA_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, 100000, 500);
        console.log("Updated TSLA-PERP to 10x max leverage");

        vault.addMarket(keccak256("COIN-PERP"), COIN_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, 100000, 500);
        console.log("Updated COIN-PERP to 10x max leverage");

        vault.addMarket(keccak256("SPY-PERP"), SPY_FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 20 * 1e18, 100000, 500);
        console.log("Updated SPY-PERP to 10x max leverage");

        vm.stopBroadcast();

        console.log("All markets now officially support up to 10x leverage on OKX X Layer!");
    }
}
