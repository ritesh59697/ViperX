// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { MockPyth } from "../src/mocks/MockPyth.sol";

/**
 * @notice Reads the X Layer market config (config/xlayer-markets.json) and the live prices that
 *         script/fetch-mock-prices.sh writes, so no deploy script carries feed ids, caps or prices.
 *
 *         Env: XLAYER_MARKETS_CONFIG (default config/xlayer-markets.json)
 *              MOCK_PRICES_FILE      (default config/generated/mock-prices.json)
 */
abstract contract XLayerMarkets is Script {
    struct Market {
        string symbol;
        bytes32 marketId;
        bytes32 pythFeedId;
        uint256 maxOiLongUsd;
        uint256 maxOiShortUsd;
        uint256 minSizeUsd;
    }

    function _marketsConfig() internal view returns (string memory) {
        return vm.readFile(vm.envOr("XLAYER_MARKETS_CONFIG", string("config/xlayer-markets.json")));
    }

    function _markets() internal view returns (Market[] memory out) {
        string memory json = _marketsConfig();
        uint256 n = _count(json, ".markets");
        out = new Market[](n);
        for (uint256 i = 0; i < n; i++) {
            string memory p = string.concat(".markets[", vm.toString(i), "]");
            string memory symbol = vm.parseJsonString(json, string.concat(p, ".symbol"));
            out[i] = Market({
                symbol: symbol,
                marketId: keccak256(bytes(symbol)),
                pythFeedId: vm.parseJsonBytes32(json, string.concat(p, ".pythFeedId")),
                maxOiLongUsd: vm.parseJsonUint(json, string.concat(p, ".maxOiLongUsd")) * 1e18,
                maxOiShortUsd: vm.parseJsonUint(json, string.concat(p, ".maxOiShortUsd")) * 1e18,
                minSizeUsd: vm.parseJsonUint(json, string.concat(p, ".minSizeUsd")) * 1e18
            });
        }
    }

    /// @dev Sets every configured market's MockPyth price from the fetched prices file. Must run
    ///      inside the oracle owner's broadcast. Refuses a file whose markets don't line up with
    ///      the config, so a stale or partial fetch can't misprice a market.
    function _setMockPrices(MockPyth pyth) internal {
        Market[] memory markets = _markets();
        string memory prices = vm.readFile(vm.envOr("MOCK_PRICES_FILE", string("config/generated/mock-prices.json")));
        require(_count(prices, ".prices") == markets.length, "mock prices: market count differs from config");
        int32 expo = int32(vm.parseJsonInt(prices, ".expo"));
        require(expo == int32(vm.parseJsonInt(_marketsConfig(), ".oracle.priceExpo")), "mock prices: expo differs from config");
        console2.log("Prices fetched at", vm.parseJsonString(prices, ".fetchedAt"));
        for (uint256 i = 0; i < markets.length; i++) {
            string memory p = string.concat(".prices[", vm.toString(i), "]");
            require(
                keccak256(bytes(vm.parseJsonString(prices, string.concat(p, ".symbol")))) == keccak256(bytes(markets[i].symbol)),
                string.concat("mock prices: entry ", vm.toString(i), " is not ", markets[i].symbol)
            );
            uint256 price = vm.parseJsonUint(prices, string.concat(p, ".price"));
            uint256 conf = vm.parseJsonUint(prices, string.concat(p, ".conf"));
            require(price > 0 && price <= uint256(uint64(type(int64).max)), "mock prices: price out of range");
            pyth.setPrice(markets[i].pythFeedId, int64(int256(price)), expo, uint64(conf));
            console2.log(string.concat(markets[i].symbol, " USD"), vm.parseJsonString(prices, string.concat(p, ".usd")));
        }
    }

    function _count(string memory json, string memory arrayKey) internal view returns (uint256 n) {
        while (vm.keyExistsJson(json, string.concat(arrayKey, "[", vm.toString(n), "]"))) n++;
    }
}
