// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ViperVault } from "../src/core/ViperVault.sol";
import { PositionRouter } from "../src/core/PositionRouter.sol";
import { PythPriceAdapter } from "../src/core/PythPriceAdapter.sol";

contract DeployViperPerp is Script {
    // Base Sepolia Addresses
    address public constant PYTH_BASE_SEPOLIA = 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729;
    // Official Testnet USDC on Base Sepolia
    address public constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Pyth Price Feed IDs
    bytes32 public constant ETH_USD_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 public constant BTC_USD_FEED = 0xe62df6e875746b43f8000b0b152753545192ddc4203240d23e1112c0200ecd92;
    bytes32 public constant SOL_USD_FEED = 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Pyth Price Adapter (max 30s staleness, max 2% confidence width)
        PythPriceAdapter adapter = new PythPriceAdapter(PYTH_BASE_SEPOLIA, 30, 200);
        console2.log("PythPriceAdapter deployed at:", address(adapter));

        // 2. Deploy ViperVault (with USDC 6 decimals)
        ViperVault vault = new ViperVault(USDC_BASE_SEPOLIA, 6, address(adapter));
        console2.log("ViperVault deployed at:", address(vault));

        // 3. Deploy PositionRouter
        PositionRouter router = new PositionRouter(address(vault), USDC_BASE_SEPOLIA, address(adapter));
        console2.log("PositionRouter deployed at:", address(router));

        // 4. Authorize PositionRouter on ViperVault
        vault.setPositionRouter(address(router), true);
        console2.log("Authorized PositionRouter on ViperVault");

        // 5. Initialize Markets: ETH-PERP, BTC-PERP, SOL-PERP
        // Max 5x leverage (50000 bps), 5% maintenance margin (500 bps), min $10 size
        vault.addMarket(keccak256("ETH-PERP"), ETH_USD_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, 50000, 500);
        vault.addMarket(keccak256("BTC-PERP"), BTC_USD_FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 20 * 1e18, 50000, 500);
        vault.addMarket(keccak256("SOL-PERP"), SOL_USD_FEED, 250_000 * 1e18, 250_000 * 1e18, 5 * 1e18, 50000, 500);

        console2.log("Initialized ETH-PERP, BTC-PERP, and SOL-PERP markets successfully!");

        vm.stopBroadcast();
    }
}
