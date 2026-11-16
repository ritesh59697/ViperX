// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { console2 } from "forge-std/Script.sol";
import { TapeOutWiring } from "./TapeOutWiring.sol";
import { XLayerMarkets } from "./XLayerMarkets.sol";
import { ViperVault } from "../src/core/ViperVault.sol";
import { PositionRouter } from "../src/core/PositionRouter.sol";
import { TapeOutCircuitGuardian } from "../src/core/TapeOutCircuitGuardian.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";

/**
 * @title DeployVaultWithCircuitXLayer
 * @notice Redeploys ViperVault with the TapeOut circuit gate applied to direct trades, plus a
 *         matching PositionRouter and Guardian, on OKX X Layer.
 *
 *         Why a redeploy rather than a setter call: the vault live on X Layer testnet predates
 *         `setCircuitGuardian` entirely, so the gate cannot be attached to it. The same is true of
 *         the live PositionRouter (neither `circuitGuardian()` nor `setCircuitGuardian(address)`
 *         is present in its deployed bytecode).
 *
 *         Markets and liquidity do NOT carry over — a fresh vault starts with neither. This script
 *         re-adds the markets and seeds liquidity so the new vault is usable on arrival; it does
 *         not attempt to migrate open positions, which cannot be moved between vaults.
 *
 *         Signing (pick one):
 *           --account <name> --sender <addr>   encrypted Foundry keystore (preferred)
 *           PRIVATE_KEY                        raw key in env (CI / local fork)
 *         The signer becomes owner of all deployed contracts.
 *
 *         The guardian evaluates real TapeOut circuits, which exist only where the TapeOut factory
 *         does — X Layer mainnet (196). Tape them out first with TapeOutRiskCircuits.s.sol.
 *
 *         Required env:
 *           XLAYER_USDC               collateral token (must be the MockUSDC the faucet UI uses)
 *           XLAYER_PRICE_ADAPTER      existing PythPriceAdapter — reused, not redeployed
 *           TAPEOUT_FACTORY_XLAYER    TapeOut factory; the guardian accepts only its processors
 *           TAPEOUT_<CHECK>_CPU / _ID the four circuits (see TapeOutWiring.sol)
 *         Markets, maintenance margin and the liquidity seed come from config/xlayer-markets.json
 *         (see XLayerMarkets.sol). On mainnet, DeployMockOracleXLayer.s.sol provides XLAYER_USDC and
 *         XLAYER_PRICE_ADAPTER.
 *         Optional env:
 *           SEED_LIQUIDITY_USDC       overrides the config's seed, in whole USDC (0 = none)
 */
contract DeployVaultWithCircuitXLayer is TapeOutWiring, XLayerMarkets {
    /// @dev Headroom between the circuit's leverage ceiling and the vault's own per-market cap,
    ///      in vault bps (10000 bps = 1x). Keeps the circuit the binding constraint on leverage
    ///      while leaving the vault cap as a backstop for a guardian-unset vault.
    uint256 public constant MARKET_LEVERAGE_HEADROOM_BPS = 50000; // +5x


    function run() external {
        // Two signing paths. Preferred: an encrypted Foundry keystore, passed as
        // `--account <name> --sender <address>`, so no raw key is ever placed in the
        // environment or shell history. Fallback: PRIVATE_KEY in env, which some CI and
        // local-fork workflows still rely on.
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        bool usingKeystore = deployerPrivateKey == 0;
        address deployer = usingKeystore ? msg.sender : vm.addr(deployerPrivateKey);
        require(deployer != address(0), "no signer: pass --account/--sender or set PRIVATE_KEY");

        address usdcAddress = vm.envAddress("XLAYER_USDC");
        address priceAdapterAddress = vm.envAddress("XLAYER_PRICE_ADAPTER");
        address tapeoutFactory = vm.envAddress("TAPEOUT_FACTORY_XLAYER");
        uint256 seedWholeUsdc = vm.envOr("SEED_LIQUIDITY_USDC", vm.parseJsonUint(_marketsConfig(), ".seedLiquidityUsdc"));

        console2.log("=== ViperX: vault + circuit gate on X Layer ===");
        console2.log("Deployer:     ", deployer);
        console2.log("Chain ID:     ", block.chainid);
        console2.log("USDC:         ", usdcAddress);
        console2.log("PriceAdapter: ", priceAdapterAddress);
        console2.log("TapeOut factory:", tapeoutFactory);

        // Circuit leverage ceiling, scaled by 100 (2000 = 20.0x) to match the guardian's own
        // normalization in computeSignals. It lives in the leverage netlist; its generated file
        // records it, and _wireFromEnv proves the on-chain netlist is that file's. The market cap
        // is derived from it below.
        uint256 maxLeverageRatio = _leverageCeiling();

        if (usingKeystore) {
            vm.startBroadcast();
        } else {
            vm.startBroadcast(deployerPrivateKey);
        }

        // 2. Fresh vault, from source that contains the circuit hook.
        ViperVault vault = new ViperVault(usdcAddress, MockUSDC(usdcAddress).decimals(), priceAdapterAddress);
        console2.log("NEW ViperVault:", address(vault));

        // 3. Router bound to the new vault.
        PositionRouter router = new PositionRouter(address(vault), usdcAddress, priceAdapterAddress);
        console2.log("NEW PositionRouter:", address(router));

        // 4. Guardian. The router is its primary caller; the vault is authorized separately so
        //    direct trades are gated too.
        TapeOutCircuitGuardian guardian = new TapeOutCircuitGuardian(tapeoutFactory, address(router));
        guardian.setAuthorizedCaller(address(vault), true);
        console2.log("Guardian:     ", address(guardian));
        _wireFromEnv(guardian);

        // 5. Wire the gate into both entry paths.
        vault.setCircuitGuardian(address(guardian));
        router.setCircuitGuardian(address(guardian));
        vault.setPositionRouter(address(router), true);

        // 6. Markets. A fresh vault has none, so the UI would show nothing tradeable without this.
        //
        //    The per-market cap is derived from the circuit's own leverage ceiling rather than
        //    fixed at the previous 10x (100000 bps). ViperVault.openPosition checks
        //    `market.maxLeverageBps` BEFORE calling _evaluateCircuit, so a market cap at or below
        //    the circuit ceiling makes the circuit's leverage comparator mathematically
        //    unreachable — every over-leveraged trade reverts with MaxLeverageExceeded and the
        //    gate it is supposed to demonstrate never fires. Seating the market cap above the
        //    ceiling (MARKET_LEVERAGE_HEADROOM_BPS) makes the circuit the binding constraint, so
        //    a leverage breach is attributable to the circuit and returns diagnostic bit 1.
        //
        //    The vault cap still exists as a backstop: it rejects anything beyond the circuit's
        //    reach even if the guardian is later unset.
        uint256 marketMaxLeverageBps = (uint256(maxLeverageRatio) * 100) + MARKET_LEVERAGE_HEADROOM_BPS;
        console2.log("Circuit leverage ceiling (x100):", maxLeverageRatio);
        console2.log("Market maxLeverageBps:          ", marketMaxLeverageBps);
        _addMarkets(vault, marketMaxLeverageBps);

        // 7. Seed LP liquidity so trades can actually be counterparty-matched. Opt-in: the amount
        //    must be real and held by the deployer, rather than a figure asserted in docs.
        if (seedWholeUsdc > 0) {
            uint256 seed = seedWholeUsdc * 10 ** MockUSDC(usdcAddress).decimals();
            MockUSDC(usdcAddress).approve(address(vault), seed);
            vault.depositLiquidity(seed);
            console2.log("Seeded liquidity (USDC):", seedWholeUsdc);
        } else {
            console2.log("No liquidity seeded (seed is 0).");
        }

        vm.stopBroadcast();

        // Read every wiring decision back out of the deployed contracts.
        console2.log("=== Post-deploy verification ===");
        console2.log("vault.circuitGuardian():  ", address(vault.circuitGuardian()));
        console2.log("router.circuitGuardian(): ", address(router.circuitGuardian()));
        console2.log("guardian circuits set:   ", guardian.configuredCount());
        console2.log("guardian authed vault:   ", guardian.isAuthorizedCaller(address(vault)));
        console2.log("vault authed router:     ", vault.isPositionRouter(address(router)));
        console2.log("vault totalAssets():     ", vault.totalAssets());

        require(address(vault.circuitGuardian()) == address(guardian), "gate not wired into vault");
        require(address(router.circuitGuardian()) == address(guardian), "gate not wired into router");
        require(guardian.configuredCount() == guardian.CHECK_COUNT(), "guardian circuits not all set");
        require(guardian.isAuthorizedCaller(address(vault)), "vault not authorized on guardian");
        require(vault.isPositionRouter(address(router)), "router not authorized on vault");

        console2.log("");
        console2.log("Update these everywhere (old addresses are now stale):");
        console2.log("NEXT_PUBLIC_XLAYER_VIPER_VAULT=", address(vault));
        console2.log("NEXT_PUBLIC_XLAYER_POSITION_ROUTER=", address(router));
        console2.log("NEXT_PUBLIC_XLAYER_CIRCUIT_GUARDIAN=", address(guardian));
    }

    function _addMarkets(ViperVault vault, uint256 maxLeverageBps) internal {
        uint256 maintenanceMarginBps = vm.parseJsonUint(_marketsConfig(), ".maintenanceMarginBps");
        Market[] memory markets = _markets();
        for (uint256 i = 0; i < markets.length; i++) {
            Market memory m = markets[i];
            vault.addMarket(m.marketId, m.pythFeedId, m.maxOiLongUsd, m.maxOiShortUsd, m.minSizeUsd, maxLeverageBps, maintenanceMarginBps);
            console2.log("Market added:", m.symbol);
        }
    }
}
