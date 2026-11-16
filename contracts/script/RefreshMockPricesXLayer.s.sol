// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { XLayerMarkets } from "./XLayerMarkets.sol";
import { MockPyth } from "../src/mocks/MockPyth.sol";

/**
 * @title RefreshMockPricesXLayer
 * @notice Moves the MockPyth prices back to live market prices. Run script/fetch-mock-prices.sh
 *         first. Env: XLAYER_ORACLE (the MockPyth; signer must own it).
 *         Signing: --account <name> --sender <addr> (keystore), or PRIVATE_KEY in env.
 */
contract RefreshMockPricesXLayer is XLayerMarkets {
    function run() external {
        uint256 key = vm.envOr("PRIVATE_KEY", uint256(0));
        MockPyth pyth = MockPyth(vm.envAddress("XLAYER_ORACLE"));
        if (key == 0) vm.startBroadcast();
        else vm.startBroadcast(key);
        _setMockPrices(pyth);
        vm.stopBroadcast();
    }
}
