// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ViperVault } from "../src/core/ViperVault.sol";
import { PositionRouter } from "../src/core/PositionRouter.sol";
import { PythPriceAdapter } from "../src/core/PythPriceAdapter.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { MockPyth } from "../src/mocks/MockPyth.sol";

/**
 * @title DeployViperPerpXLayer
 * @notice Production deployment script for ViperX Perpetual DEX on OKX X Layer (Testnet & Mainnet).
 */
contract DeployViperPerpXLayer is Script {
    // Pyth Price Feed IDs
    bytes32 public constant ETH_USD_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 public constant BTC_USD_FEED = 0xe62df6e875746b43f8000b0b152753545192ddc4203240d23e1112c0200ecd92;
    bytes32 public constant SOL_USD_FEED = 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d;
    bytes32 public constant OKB_USD_FEED = keccak256("OKB-USD-FEED");
    bytes32 public constant NVDA_FEED = 0x5a54e99f0e8f000efcead7818e6e9b8971d8ad2327663f73966035eb41cf6b48;
    bytes32 public constant TSLA_FEED = 0x160934149021a0081d6d8db8618e5f8b9e67d4e41416e6378e906b38c2ef40a6;
    bytes32 public constant COIN_FEED = 0x19d554a93a7e584feab5253805494d6e9f90cf9a3e20e8b15d2a9ff60e20f4f9;
    bytes32 public constant SPY_FEED = 0x2613da66c6155551c682aa15259926a458b2914db368297f62939d37537b02ff;

    // Previous X Layer vault. Its open interest was wiped, so closes revert.
    // Liquidity is moved out; the stuck position cannot be settled there.
    address public constant PREVIOUS_VAULT = 0x01e417aA5E863Fb18E27409A6D3F4d31AcC24A89;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("==================================================");
        console2.log("Deploying ViperX on OKX X Layer");
        console2.log("Deployer Address:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("==================================================");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Resolve USDC Collateral Token
        address usdcAddress = vm.envOr("USDC_ADDRESS", address(0));
        MockUSDC mockUsdc;
        if (usdcAddress == address(0)) {
            mockUsdc = new MockUSDC();
            usdcAddress = address(mockUsdc);
            console2.log("Deployed MockUSDC (with faucet) at:", usdcAddress);
        } else {
            console2.log("Using existing USDC at:", usdcAddress);
        }

        // 2. Resolve Pyth Oracle
        address pythAddress = vm.envOr("PYTH_ORACLE_ADDRESS", address(0));
        MockPyth mockPyth;
        if (pythAddress == address(0)) {
            mockPyth = new MockPyth();
            pythAddress = address(mockPyth);

            // Seed initial reference prices (8 decimals like standard Pyth)
            // ETH: $3,200 | BTC: $94,000 | SOL: $185 | OKB: $48
            mockPyth.setPrice(ETH_USD_FEED, 3200_00000000, -8, 1_00000000);
            mockPyth.setPrice(BTC_USD_FEED, 94000_00000000, -8, 5_00000000);
            mockPyth.setPrice(SOL_USD_FEED, 185_00000000, -8, 50000000);
            mockPyth.setPrice(OKB_USD_FEED, 48_00000000, -8, 10000000);
            console2.log("Deployed MockPyth Oracle at:", pythAddress);
        } else {
            console2.log("Using existing Pyth Oracle at:", pythAddress);
            MockPyth existingPyth = MockPyth(pythAddress);
            existingPyth.setPrice(ETH_USD_FEED, 2688_00000000, -8, 1_00000000);
            existingPyth.setPrice(BTC_USD_FEED, 65500_00000000, -8, 5_00000000);
            existingPyth.setPrice(SOL_USD_FEED, 148_00000000, -8, 50000000);
            existingPyth.setPrice(OKB_USD_FEED, 48_50000000, -8, 10000000);
            existingPyth.setPrice(NVDA_FEED, 119_56000000, -8, 1000000);
            existingPyth.setPrice(TSLA_FEED, 228_40000000, -8, 1000000);
            existingPyth.setPrice(COIN_FEED, 184_20000000, -8, 1000000);
            existingPyth.setPrice(SPY_FEED, 558_00000000, -8, 1000000);
            console2.log("Refreshed MockPyth prices");
        }

        // Staleness 0: MockPyth skips the age check when maxAge is 0.
        // A 60s window made closes revert an hour after the last price update.
        PythPriceAdapter adapter = new PythPriceAdapter(pythAddress, 0, 500);
        console2.log("PythPriceAdapter deployed at:", address(adapter));

        // 4. Deploy ViperVault (6 decimals for USDC collateral)
        ViperVault vault = new ViperVault(usdcAddress, 6, address(adapter));
        console2.log("ViperVault deployed at:", address(vault));

        // 5. Deploy PositionRouter
        PositionRouter router = new PositionRouter(address(vault), usdcAddress, address(adapter));
        console2.log("PositionRouter deployed at:", address(router));

        // 6. Authorize PositionRouter on ViperVault
        vault.setPositionRouter(address(router), true);
        console2.log("Authorized PositionRouter on ViperVault");

        // 10x from the start (100000 bps). Rewriting markets later is what zeroed
        // open interest on the previous vault. addMarket now preserves it anyway.
        vault.addMarket(keccak256("ETH-PERP"), ETH_USD_FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 10 * 1e18, 100000, 500);
        vault.addMarket(keccak256("BTC-PERP"), BTC_USD_FEED, 2_000_000 * 1e18, 2_000_000 * 1e18, 20 * 1e18, 100000, 500);
        vault.addMarket(keccak256("SOL-PERP"), SOL_USD_FEED, 500_000 * 1e18, 500_000 * 1e18, 5 * 1e18, 100000, 500);
        vault.addMarket(keccak256("OKB-PERP"), OKB_USD_FEED, 500_000 * 1e18, 500_000 * 1e18, 5 * 1e18, 100000, 500);
        vault.addMarket(keccak256("NVDA-PERP"), NVDA_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, 100000, 500);
        vault.addMarket(keccak256("TSLA-PERP"), TSLA_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, 100000, 500);
        vault.addMarket(keccak256("COIN-PERP"), COIN_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, 100000, 500);
        vault.addMarket(keccak256("SPY-PERP"), SPY_FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 20 * 1e18, 100000, 500);
        console2.log("Initialized crypto and RWA markets at 10x");

        // Pull LP liquidity off the broken vault, then seed this one.
        ViperVault previous = ViperVault(PREVIOUS_VAULT);
        uint256 oldShares = previous.balanceOf(deployer);
        if (oldShares > 0) {
            previous.withdrawLiquidity(oldShares);
            console2.log("Withdrew LP shares from previous vault");
        }

        uint256 seed = 500_000 * 1e6;
        MockUSDC collateral = address(mockUsdc) != address(0) ? mockUsdc : MockUSDC(usdcAddress);
        collateral.approve(address(vault), seed);
        vault.depositLiquidity(seed);
        console2.log("Seeded ViperVault with $500,000 USDC liquidity");

        vm.stopBroadcast();

        console2.log("==================================================");
        console2.log("DEPLOYMENT COMPLETE - COPY THESE TO FRONTEND & DOCS:");
        console2.log("NEXT_PUBLIC_XLAYER_VIPER_VAULT=", address(vault));
        console2.log("NEXT_PUBLIC_XLAYER_POSITION_ROUTER=", address(router));
        console2.log("NEXT_PUBLIC_XLAYER_PRICE_ADAPTER=", address(adapter));
        console2.log("NEXT_PUBLIC_XLAYER_USDC=", usdcAddress);
        console2.log("NEXT_PUBLIC_XLAYER_ORACLE=", pythAddress);
        console2.log("==================================================");
    }
}
