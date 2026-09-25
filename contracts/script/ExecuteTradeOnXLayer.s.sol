// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import {ViperVault} from "../src/core/ViperVault.sol";
import {IViperVault} from "../src/interfaces/IViperVault.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockPyth} from "../src/mocks/MockPyth.sol";
import {PythPriceAdapter} from "../src/core/PythPriceAdapter.sol";

contract ExecuteTradeOnXLayer is Script {
    address constant VIPER_VAULT = 0x9Dcfe752AC97F167763FeD87f4100F33cD29dbb7;
    address constant MOCK_USDC = 0x6046c644ea622fBa3043F35d979BAEE83339cfEe;
    address constant MOCK_PYTH = 0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee;
    address constant PRICE_ADAPTER = 0xcce8dbdde8a997217CFf51c4A2076f3B9Eb44b70;

    bytes32 constant OKB_USD_FEED = keccak256("OKB-USD-FEED");

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Executing Live Trade on OKX X Layer Testnet ===");
        console.log("Trader address:", deployer);

        bytes32 marketId = keccak256("OKB-PERP");
        IViperVault.PositionSide side = IViperVault.PositionSide.LONG;
        uint256 sizeUsd = 300 ether; // $300 position
        uint256 collateralUsd = 100 ether; // $100 margin (3x leverage)
        uint256 rawUsdc = 100 * 1e6; // 100 USDC (6 decimals)

        vm.startBroadcast(deployerPrivateKey);

        // 1. Set max staleness to 0 on adapter so oracle prices never expire on testnet
        PythPriceAdapter(PRICE_ADAPTER).setMaxStaleness(0);
        console.log("Updated PythPriceAdapter max staleness to 0");

        // 2. Also refresh mock Pyth price timestamp to current block
        MockPyth(MOCK_PYTH).setPrice(OKB_USD_FEED, 48_00000000, -8, 10000000);
        console.log("Refreshed OKB price on MockPyth to $48.00");

        // 3. Approve USDC
        MockUSDC(MOCK_USDC).approve(VIPER_VAULT, rawUsdc);
        console.log("Approved USDC for ViperVault");

        // 4. Open Position on OKB-PERP
        bytes32 posKey = ViperVault(VIPER_VAULT).openPosition(marketId, side, sizeUsd, collateralUsd);
        console.log("SUCCESS! Opened OKB-PERP Long Position! Key:");
        console.logBytes32(posKey);

        vm.stopBroadcast();
    }
}
