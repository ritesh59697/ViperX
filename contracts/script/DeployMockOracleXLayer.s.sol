// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { console2 } from "forge-std/Script.sol";
import { XLayerMarkets } from "./XLayerMarkets.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { MockPyth } from "../src/mocks/MockPyth.sol";
import { PythPriceAdapter } from "../src/core/PythPriceAdapter.sol";

/**
 * @title DeployMockOracleXLayer
 * @notice Deploys the demo collateral and oracle a fresh ViperVault needs: MockUSDC (public faucet;
 *         the deployer receives the initial supply, which seeds the vault), a MockPyth set to live
 *         prices, and the PythPriceAdapter the vault reads. Run script/fetch-mock-prices.sh first.
 *
 *         Signing: --account <name> --sender <addr> (keystore), or PRIVATE_KEY in env.
 *         Reads config/xlayer-markets.json (see XLayerMarkets.sol). Prints the XLAYER_USDC /
 *         XLAYER_PRICE_ADAPTER / XLAYER_ORACLE lines DeployVaultWithCircuitXLayer reads.
 */
contract DeployMockOracleXLayer is XLayerMarkets {
    function run() external {
        uint256 key = vm.envOr("PRIVATE_KEY", uint256(0));
        string memory config = _marketsConfig();
        uint256 maxStaleness = vm.parseJsonUint(config, ".oracle.maxStalenessSeconds");
        uint256 maxConfBps = vm.parseJsonUint(config, ".oracle.maxConfidenceRatioBps");

        if (key == 0) vm.startBroadcast();
        else vm.startBroadcast(key);

        MockUSDC usdc = new MockUSDC();
        MockPyth pyth = new MockPyth();
        _setMockPrices(pyth);
        PythPriceAdapter adapter = new PythPriceAdapter(address(pyth), maxStaleness, maxConfBps);

        vm.stopBroadcast();

        Market[] memory markets = _markets();
        for (uint256 i = 0; i < markets.length; i++) {
            require(adapter.getNormalizedPrice(markets[i].pythFeedId) > 0, string.concat(markets[i].symbol, ": no price"));
        }

        console2.log("XLAYER_USDC=", address(usdc));
        console2.log("XLAYER_ORACLE=", address(pyth));
        console2.log("XLAYER_PRICE_ADAPTER=", address(adapter));
    }
}
