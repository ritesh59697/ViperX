// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import {MockPyth} from "../src/mocks/MockPyth.sol";

contract UpdateMockPythPrices is Script {
    address constant MOCK_PYTH = 0xA256D01Ca6e89c5B6bDf34F3dd68eBfF47f2C7ee;

    bytes32 constant ETH_USD_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 constant BTC_USD_FEED = 0xe62df6e875746b43f8000b0b152753545192ddc4203240d23e1112c0200ecd92;
    bytes32 constant SOL_USD_FEED = 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d;
    bytes32 constant OKB_USD_FEED = keccak256("OKB-USD-FEED");

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=== Updating MockPyth Oracle to Real Market Prices ===");

        vm.startBroadcast(deployerPrivateKey);

        // ETH: $2,688.00 (matching live TradingView & Binance)
        MockPyth(MOCK_PYTH).setPrice(ETH_USD_FEED, 2688_00000000, -8, 10000000);
        console.log("Updated ETH-USD feed to $2,688.00");

        // BTC: $65,500.00
        MockPyth(MOCK_PYTH).setPrice(BTC_USD_FEED, 65500_00000000, -8, 50000000);
        console.log("Updated BTC-USD feed to $65,500.00");

        // SOL: $148.00
        MockPyth(MOCK_PYTH).setPrice(SOL_USD_FEED, 148_00000000, -8, 10000000);
        console.log("Updated SOL-USD feed to $148.00");

        // OKB: $48.50
        MockPyth(MOCK_PYTH).setPrice(OKB_USD_FEED, 48_50000000, -8, 10000000);
        console.log("Updated OKB-USD feed to $48.50");

        vm.stopBroadcast();
        console.log("All oracle prices synchronized successfully!");
    }
}
