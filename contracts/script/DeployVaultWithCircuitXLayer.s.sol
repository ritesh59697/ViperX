// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ViperVault } from "../src/core/ViperVault.sol";
import { PositionRouter } from "../src/core/PositionRouter.sol";
import { TapeOutCircuitGuardian } from "../src/core/TapeOutCircuitGuardian.sol";
import { TapeOutCircuitProcessor } from "../src/core/TapeOutCircuitProcessor.sol";
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
 *         Required env:
 *           XLAYER_USDC               collateral token (must be the MockUSDC the faucet UI uses)
 *           XLAYER_PRICE_ADAPTER      existing PythPriceAdapter — reused, not redeployed
 *         Optional env:
 *           TAPEOUT_PROCESSOR_ADDRESS an externally-operated TapeOut processor to gate against.
 *                                     If unset, ViperX's own TapeOutCircuitProcessor is deployed
 *                                     and the circuit registered on it.
 *           TAPEOUT_CIRCUIT_ID        circuit to evaluate against (default 101)
 *           SEED_LIQUIDITY_USDC       LP liquidity to seed, in whole USDC (default 0 = none)
 */
contract DeployVaultWithCircuitXLayer is Script {
    /// @dev Headroom between the circuit's leverage ceiling and the vault's own per-market cap,
    ///      in vault bps (10000 bps = 1x). Keeps the circuit the binding constraint on leverage
    ///      while leaving the vault cap as a backstop for a guardian-unset vault.
    uint256 public constant MARKET_LEVERAGE_HEADROOM_BPS = 50000; // +5x

    bytes32 public constant ETH_USD_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 public constant BTC_USD_FEED = 0xe62df6e875746b43f8000b0b152753545192ddc4203240d23e1112c0200ecd92;
    bytes32 public constant SOL_USD_FEED = 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d;
    bytes32 public constant OKB_USD_FEED = keccak256("OKB-USD-FEED");
    bytes32 public constant NVDA_FEED = 0x5a54e99f0e8f000efcead7818e6e9b8971d8ad2327663f73966035eb41cf6b48;
    bytes32 public constant TSLA_FEED = 0x160934149021a0081d6d8db8618e5f8b9e67d4e41416e6378e906b38c2ef40a6;
    bytes32 public constant COIN_FEED = 0x19d554a93a7e584feab5253805494d6e9f90cf9a3e20e8b15d2a9ff60e20f4f9;
    bytes32 public constant SPY_FEED = 0x2613da66c6155551c682aa15259926a458b2914db368297f62939d37537b02ff;

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
        address processorAddress = vm.envOr("TAPEOUT_PROCESSOR_ADDRESS", address(0));
        uint256 circuitId = vm.envOr("TAPEOUT_CIRCUIT_ID", uint256(101));
        uint256 seedWholeUsdc = vm.envOr("SEED_LIQUIDITY_USDC", uint256(0));

        console2.log("=== ViperX: vault + circuit gate on X Layer ===");
        console2.log("Deployer:     ", deployer);
        console2.log("Chain ID:     ", block.chainid);
        console2.log("USDC:         ", usdcAddress);
        console2.log("PriceAdapter: ", priceAdapterAddress);
        console2.log("Circuit ID:   ", circuitId);

        bool selfHostingProcessor = processorAddress == address(0);

        // Circuit leverage ceiling, scaled by 100 (2000 = 20.0x) to match the guardian's own
        // normalization in validateIntent. The market cap is derived from this below.
        uint32 maxLeverageRatio = uint32(vm.envOr("TAPEOUT_MAX_LEVERAGE_RATIO", uint256(2000)));

        if (usingKeystore) {
            vm.startBroadcast();
        } else {
            vm.startBroadcast(deployerPrivateKey);
        }

        // 1. Processor. If an externally-operated processor address is supplied, gate against it.
        //    Otherwise ViperX hosts its own — no shared processor address has been published for
        //    chain 1952, and the guardian can be repointed later via setProcessor().
        if (selfHostingProcessor) {
            TapeOutCircuitProcessor processor = new TapeOutCircuitProcessor();
            processorAddress = address(processor);
            processor.registerCircuit({
                circuitId: circuitId,
                maxLeverageRatio: maxLeverageRatio,
                maxSlippageBps: 200, // 2.00% ceiling
                maxDrawdownBps: 2500, // 25.00% killswitch
                minCooldownSeconds: 10 // 10s anti-wash latch
            });
            console2.log("Processor:    ", processorAddress, "(ViperX self-hosted)");
        } else {
            console2.log("Processor:    ", processorAddress, "(external)");
        }

        // 2. Fresh vault, from source that contains the circuit hook.
        ViperVault vault = new ViperVault(usdcAddress, 6, priceAdapterAddress);
        console2.log("NEW ViperVault:", address(vault));

        // 3. Router bound to the new vault.
        PositionRouter router = new PositionRouter(address(vault), usdcAddress, priceAdapterAddress);
        console2.log("NEW PositionRouter:", address(router));

        // 4. Guardian. The router is its primary caller; the vault is authorized separately so
        //    direct trades are gated too.
        TapeOutCircuitGuardian guardian = new TapeOutCircuitGuardian(
            processorAddress,
            circuitId,
            address(router)
        );
        guardian.setAuthorizedCaller(address(vault), true);
        console2.log("Guardian:     ", address(guardian));

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
        vault.addMarket(keccak256("ETH-PERP"), ETH_USD_FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 10 * 1e18, marketMaxLeverageBps, 500);
        vault.addMarket(keccak256("BTC-PERP"), BTC_USD_FEED, 2_000_000 * 1e18, 2_000_000 * 1e18, 20 * 1e18, marketMaxLeverageBps, 500);
        vault.addMarket(keccak256("SOL-PERP"), SOL_USD_FEED, 500_000 * 1e18, 500_000 * 1e18, 5 * 1e18, marketMaxLeverageBps, 500);
        vault.addMarket(keccak256("OKB-PERP"), OKB_USD_FEED, 500_000 * 1e18, 500_000 * 1e18, 5 * 1e18, marketMaxLeverageBps, 500);
        vault.addMarket(keccak256("NVDA-PERP"), NVDA_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, marketMaxLeverageBps, 500);
        vault.addMarket(keccak256("TSLA-PERP"), TSLA_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, marketMaxLeverageBps, 500);
        vault.addMarket(keccak256("COIN-PERP"), COIN_FEED, 500_000 * 1e18, 500_000 * 1e18, 10 * 1e18, marketMaxLeverageBps, 500);
        vault.addMarket(keccak256("SPY-PERP"), SPY_FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 20 * 1e18, marketMaxLeverageBps, 500);
        console2.log("Markets added: 8");

        // 7. Seed LP liquidity so trades can actually be counterparty-matched. Opt-in: the amount
        //    must be real and held by the deployer, rather than a figure asserted in docs.
        if (seedWholeUsdc > 0) {
            uint256 seed = seedWholeUsdc * 1e6;
            MockUSDC(usdcAddress).approve(address(vault), seed);
            vault.depositLiquidity(seed);
            console2.log("Seeded liquidity (USDC):", seedWholeUsdc);
        } else {
            console2.log("No liquidity seeded (SEED_LIQUIDITY_USDC unset).");
        }

        vm.stopBroadcast();

        // Read every wiring decision back out of the deployed contracts.
        console2.log("=== Post-deploy verification ===");
        console2.log("vault.circuitGuardian():  ", address(vault.circuitGuardian()));
        console2.log("router.circuitGuardian(): ", address(router.circuitGuardian()));
        console2.log("guardian.processor():     ", address(guardian.processor()));
        console2.log("guardian.circuitId():    ", guardian.circuitId());
        console2.log("guardian authed vault:   ", guardian.isAuthorizedCaller(address(vault)));
        console2.log("vault authed router:     ", vault.isPositionRouter(address(router)));
        console2.log("vault totalAssets():     ", vault.totalAssets());

        require(address(vault.circuitGuardian()) == address(guardian), "gate not wired into vault");
        require(address(router.circuitGuardian()) == address(guardian), "gate not wired into router");
        require(address(guardian.processor()) == processorAddress, "processor not wired");
        require(guardian.isAuthorizedCaller(address(vault)), "vault not authorized on guardian");
        require(vault.isPositionRouter(address(router)), "router not authorized on vault");

        if (selfHostingProcessor) {
            console2.log("");
            console2.log("NOTE: gated by ViperX's own TapeOutCircuitProcessor, not an OKX-operated");
            console2.log("one. Describe it as such. To repoint at an official processor later:");
            console2.log("guardian.setProcessor(addr, circuitId) - no vault/router redeploy.");
        }

        console2.log("");
        console2.log("Update these everywhere (old addresses are now stale):");
        console2.log("NEXT_PUBLIC_XLAYER_VIPER_VAULT=", address(vault));
        console2.log("NEXT_PUBLIC_XLAYER_POSITION_ROUTER=", address(router));
        console2.log("NEXT_PUBLIC_XLAYER_CIRCUIT_GUARDIAN=", address(guardian));
        console2.log("TAPEOUT_PROCESSOR_ADDRESS=", processorAddress);
    }
}
