// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITapeOutFactory, ITapeOutProcessor, ITapeOutTransistors } from "../../src/interfaces/ITapeOut.sol";
import { ITapeOutCircuitGuardian } from "../../src/interfaces/ITapeOutCircuitGuardian.sol";
import { TapeOutCircuitGuardian } from "../../src/core/TapeOutCircuitGuardian.sol";
import { ViperVault } from "../../src/core/ViperVault.sol";
import { PythPriceAdapter } from "../../src/core/PythPriceAdapter.sol";
import { IViperVault } from "../../src/interfaces/IViperVault.sol";
import { IPositionRouter } from "../../src/interfaces/IPositionRouter.sol";
import { GateMockUSDC, GateMockPyth } from "../ViperVaultCircuitGate.t.sol";

/**
 * @notice The guardian on the REAL TapeOut processor, on a fork of X Layer mainnet: the four shipped
 *         risk circuits are taped out to one processor through the factory (paying its real fees),
 *         wired into a guardian that accepts only that factory's processors, and a ViperVault trade
 *         is gated by four `processor.eval` calls.
 *
 *         Run:  set -a; source .env.example; set +a; forge test --match-path test/fork/GuardianRealCircuits.fork.t.sol -vv
 *         Skipped when TAPEOUT_FACTORY_XLAYER is unset.
 */
contract GuardianRealCircuitsForkTest is Test {
    ITapeOutFactory internal factory;
    ITapeOutProcessor internal cpu;
    TapeOutCircuitGuardian internal guardian;
    ViperVault internal vault;
    GateMockUSDC internal usdc;
    GateMockPyth internal pyth;

    address internal operator; // EOA: receives the processor NFT and gate tokens
    address internal trader = address(0x200);
    bytes32 internal constant MARKET = keccak256("ETH-PERP");
    bytes32 internal constant FEED = keccak256("ETH-USD-FEED");

    string[4] internal files = ["leverage_le", "slippage_le", "drawdown_le", "cooldown_ge"];
    uint32 constant DIAG_LEVERAGE = 1 << 0;
    uint32 constant DIAG_DRAWDOWN = 1 << 2;
    uint32 constant DIAG_COOLDOWN = 1 << 3;

    function setUp() public {
        address factoryAddr = vm.envOr("TAPEOUT_FACTORY_XLAYER", address(0));
        if (factoryAddr == address(0)) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(vm.rpcUrl(vm.envOr("TAPEOUT_FORK_RPC_ALIAS", string("xlayer_mainnet"))));
        factory = ITapeOutFactory(factoryAddr);
        operator = makeAddr("tapeout-operator");

        uint256[4] memory ids = _tapeoutAll();

        guardian = new TapeOutCircuitGuardian(address(factory), address(0));
        for (uint256 i = 0; i < 4; i++) {
            guardian.setCircuit(ITapeOutCircuitGuardian.Check(i), address(cpu), ids[i]);
        }

        // Vault with the deploy script's leverage relationship: market cap = circuit ceiling + 5x.
        usdc = new GateMockUSDC();
        pyth = new GateMockPyth();
        PythPriceAdapter adapter = new PythPriceAdapter(address(pyth), 60, 500);
        vault = new ViperVault(address(usdc), 6, address(adapter));
        string memory lev = vm.readFile("tapeout/circuits/leverage_le.json");
        uint256 capBps = vm.parseJsonUint(lev, ".max") * 100 + 50000;
        pyth.setPrice(FEED, 3000_00000000, -8, 1_00000000);
        vault.addMarket(MARKET, FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 10 * 1e18, capBps, 500);
        guardian.setAuthorizedCaller(address(vault), true);
        vault.setCircuitGuardian(address(guardian));

        usdc.mint(address(this), 100_000 * 1e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositLiquidity(50_000 * 1e6);
        usdc.mint(trader, 100_000 * 1e6);
        vm.prank(trader);
        usdc.approve(address(vault), type(uint256).max);
    }

    /// One processor, four circuits, every fee read from chain — the flow TapeOutRiskCircuits.s.sol runs.
    function _tapeoutAll() internal returns (uint256[4] memory ids) {
        bytes[4] memory nl;
        uint32[4] memory nIn;
        uint256 gates;
        for (uint256 i = 0; i < 4; i++) {
            string memory json = vm.readFile(string.concat("tapeout/circuits/", files[i], ".json"));
            nl[i] = vm.parseJsonBytes(json, ".netlist");
            nIn[i] = uint32(vm.parseJsonUint(json, ".nIn"));
            gates += vm.parseJsonUint(json, ".gates");
        }
        IERC20 bem = IERC20(factory.bem());
        deal(address(bem), operator, factory.deployFee());

        vm.startPrank(operator, operator);
        uint256 index = factory.cpuCount();
        bem.approve(address(factory), factory.deployFee());
        ITapeOutTransistors t = ITapeOutTransistors(factory.createCPU("ViperX Risk", "VXR", "fork", gates, 0));
        cpu = ITapeOutProcessor(factory.cpuAt(index));
        uint256 mintCost = t.mintPrice() * gates + t.protocolFee();
        vm.stopPrank();
        deal(address(bem), operator, mintCost);
        vm.deal(operator, cpu.TAPEOUT_FEE() * 4);

        vm.startPrank(operator, operator);
        bem.approve(address(t), mintCost);
        t.mint(t.NAND(), gates);
        for (uint256 i = 0; i < 4; i++) {
            ids[i] = cpu.tapeout{ value: cpu.TAPEOUT_FEE() }(nl[i], nIn[i], 1);
        }
        vm.stopPrank();
        assertEq(t.balanceOf(operator, t.NAND()), 0, "every minted gate burned into the four circuits");
        console2.log("processor", address(cpu), "total gates", gates);
    }

    function _open(uint256 sizeUsd) internal returns (bytes32) {
        vm.prank(trader);
        return vault.openPosition(MARKET, IViperVault.PositionSide.LONG, sizeUsd, 1_000 * 1e18);
    }

    function test_Fork_CompliantTradeOpensThroughRealCircuits() public {
        uint256 g = gasleft();
        bytes32 key = _open(2_000 * 1e18);
        console2.log("openPosition gas incl. 4 real evals", g - gasleft());
        (,,, uint256 size,,,,) = vault.positions(key);
        assertEq(size, 2_000 * 1e18);
        assertEq(guardian.lastTradeTime(trader), block.timestamp);
    }

    function test_Fork_LeverageBreachRejectedByCircuit() public {
        // 22x: inside the vault's 25x cap, beyond the circuit's 20x — only the circuit can reject it.
        vm.expectRevert(abi.encodeWithSelector(ViperVault.CircuitRiskRejected.selector, DIAG_LEVERAGE));
        _open(22_000 * 1e18);
    }

    function test_Fork_CooldownAndDrawdownRejectedByCircuit() public {
        _open(2_000 * 1e18);
        vm.warp(block.timestamp + 3);
        vm.expectRevert(abi.encodeWithSelector(ViperVault.CircuitRiskRejected.selector, DIAG_COOLDOWN));
        _open(1_000 * 1e18);

        vm.warp(block.timestamp + 10);
        guardian.setAgentDrawdown(trader, 3000);
        vm.expectRevert(abi.encodeWithSelector(ViperVault.CircuitRiskRejected.selector, DIAG_DRAWDOWN));
        _open(1_000 * 1e18);
    }

    /// 65537 (655.37x) truncated to 16 bits is 1; saturated it is 65535 and the real circuit rejects it.
    function test_Fork_OversizedLeverageSaturates() public {
        IPositionRouter.AgentIntent memory i = IPositionRouter.AgentIntent({
            agent: trader,
            marketId: MARKET,
            side: IViperVault.PositionSide.LONG,
            sizeUsd: 65_537 * 1e18,
            collateralUsd: 100 * 1e18,
            maxSlippagePrice: 3000 * 1e18,
            deadline: block.timestamp,
            nonce: 0
        });
        (bool passed, uint32 diag,) = guardian.validateIntent(i, 3000 * 1e18);
        assertFalse(passed);
        assertEq(diag, DIAG_LEVERAGE);
    }

    function test_Fork_RejectsProcessorOutsideFactory() public {
        vm.expectRevert(abi.encodeWithSelector(TapeOutCircuitGuardian.NotTapeOutProcessor.selector, address(vault)));
        guardian.setCircuit(ITapeOutCircuitGuardian.Check.LEVERAGE, address(vault), 1);
    }
}
