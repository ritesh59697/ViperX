// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { TapeOutCircuitFixture } from "./utils/TapeOutCircuitFixture.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ViperVault } from "../src/core/ViperVault.sol";
import { PythPriceAdapter } from "../src/core/PythPriceAdapter.sol";
import { TapeOutCircuitGuardian } from "../src/core/TapeOutCircuitGuardian.sol";
import { ITapeOutCircuitGuardian } from "../src/interfaces/ITapeOutCircuitGuardian.sol";
import { IPyth, PythPrice } from "../src/interfaces/IPyth.sol";
import { IViperVault } from "../src/interfaces/IViperVault.sol";

contract GateMockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract GateMockPyth is IPyth {
    mapping(bytes32 => PythPrice) public prices;

    function setPrice(bytes32 id, int64 price, int32 expo, uint64 conf) external {
        prices[id] = PythPrice({ price: price, conf: conf, expo: expo, publishTime: block.timestamp });
    }

    function getPriceNoOlderThan(bytes32 id, uint256) external view override returns (PythPrice memory) {
        return prices[id];
    }

    function getPrice(bytes32 id) external view override returns (PythPrice memory) {
        return prices[id];
    }

    function getUpdateFee(bytes[] calldata) external pure override returns (uint256) {
        return 0;
    }

    function updatePriceFeeds(bytes[] calldata) external payable override {}
}

/**
 * @title ViperVaultCircuitGateTest
 * @notice Covers the TapeOut circuit gate on trades sent DIRECTLY to ViperVault — the path the
 *         /trade UI actually uses. The pre-existing TapeOutCircuitGuardian tests only cover the
 *         PositionRouter path, which no frontend code reaches.
 */
contract ViperVaultCircuitGateTest is TapeOutCircuitFixture {
    GateMockUSDC public usdc;
    GateMockPyth public pyth;
    PythPriceAdapter public adapter;
    ViperVault public vault;
    TapeOutCircuitGuardian public guardian;

    address public lp = address(0x100);
    address public agent = address(0x200);

    bytes32 public constant ETH_MARKET = keccak256("ETH-PERP");
    bytes32 public constant ETH_PYTH_FEED = keccak256("ETH-USD-FEED");

    // Diagnostic bits emitted by the circuit's comparators.
    uint32 constant DIAG_LEVERAGE = 1 << 0;
    uint32 constant DIAG_SLIPPAGE = 1 << 1;
    uint32 constant DIAG_DRAWDOWN = 1 << 2;
    uint32 constant DIAG_COOLDOWN = 1 << 3;

    function setUp() public {
        usdc = new GateMockUSDC();
        pyth = new GateMockPyth();
        adapter = new PythPriceAdapter(address(pyth), 60, 500);
        vault = new ViperVault(address(usdc), 6, address(adapter));

        pyth.setPrice(ETH_PYTH_FEED, 3000_00000000, -8, 1_00000000);
        vault.addMarket(
            ETH_MARKET,
            ETH_PYTH_FEED,
            1_000_000 * 1e18,
            1_000_000 * 1e18,
            10 * 1e18,
            50000, // vault's own 5x cap
            500
        );

        // Leverage circuit deliberately at 3.0x (fixtures/leverage_le_300) so each gate can be tripped
        // from inside the vault's own 5x cap: the shipped 20x ceiling is unreachable here and would
        // never fire. Slippage 2.00%, drawdown 25.00%, cooldown 10s are the shipped circuits.
        _deployTapeOut();

        // positionRouter is address(0): this suite exercises the direct-to-vault path only.
        guardian = new TapeOutCircuitGuardian(address(tapeoutFactory), address(0));
        _wire(guardian, "fixtures/leverage_le_300", "slippage_le", "drawdown_le", "cooldown_ge");
        guardian.setAuthorizedCaller(address(vault), true);
        vault.setCircuitGuardian(address(guardian));

        usdc.mint(lp, 100_000 * 1e6);
        usdc.mint(agent, 100_000 * 1e6);

        vm.startPrank(lp);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositLiquidity(50_000 * 1e6);
        vm.stopPrank();

        vm.startPrank(agent);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();

        // Clear the cooldown latch so the first trade of each test is not itself blocked.
        vm.warp(block.timestamp + 1 hours);
    }

    function test_Gate_AllowsCompliantDirectTrade() public {
        // 2x leverage, inside the circuit's 3x ceiling.
        vm.prank(agent);
        bytes32 posKey = vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 2_000 * 1e18, 1_000 * 1e18);

        (,,, uint256 posSize,,,,) = vault.positions(posKey);
        assertEq(posSize, 2_000 * 1e18, "compliant trade should open");
        assertEq(guardian.lastTradeTime(agent), block.timestamp, "execution should be recorded");
    }

    function test_Gate_BlocksLeverageBreachOnDirectTrade() public {
        // 4x leverage: allowed by the vault's 5x cap, rejected by the circuit's 3x ceiling.
        // This is the case that proves the circuit is a real constraint and not a restatement
        // of limits the vault already enforces.
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ViperVault.CircuitRiskRejected.selector, DIAG_LEVERAGE));
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 4_000 * 1e18, 1_000 * 1e18);
    }

    function test_Gate_BlocksRapidReentryAsWashTrade() public {
        vm.prank(agent);
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 2_000 * 1e18, 1_000 * 1e18);

        // Second trade 4s later: inside the circuit's 10s anti-wash latch.
        vm.warp(block.timestamp + 4);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ViperVault.CircuitRiskRejected.selector, DIAG_COOLDOWN));
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 2_000 * 1e18, 1_000 * 1e18);
    }

    function test_Gate_AllowsReentryOnceCooldownElapses() public {
        vm.prank(agent);
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 2_000 * 1e18, 1_000 * 1e18);

        vm.warp(block.timestamp + 11);
        vm.prank(agent);
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 2_000 * 1e18, 1_000 * 1e18);

        bytes32 posKey = vault.getPositionKey(agent, ETH_MARKET, IViperVault.PositionSide.LONG);
        (,,, uint256 posSize,,,,) = vault.positions(posKey);
        assertEq(posSize, 4_000 * 1e18, "both trades should be in the position");
    }

    function test_Gate_BlocksOnDrawdownKillswitch() public {
        guardian.setAgentDrawdown(agent, 3000); // 30% > 25% ceiling

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ViperVault.CircuitRiskRejected.selector, DIAG_DRAWDOWN));
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 2_000 * 1e18, 1_000 * 1e18);
    }

    function test_Gate_DirectTradeReportsZeroSlippage() public {
        // A direct caller names no limit price, so the slippage comparator must see 0 bps and
        // never contribute a breach — even with the circuit's slippage ceiling set to zero.
        guardian.setCircuit(
            ITapeOutCircuitGuardian.Check.SLIPPAGE, address(tapeoutCpu), _tapeoutCircuit("fixtures/slippage_le_0")
        );

        vm.prank(agent);
        bytes32 posKey = vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 2_000 * 1e18, 1_000 * 1e18);

        (,,, uint256 posSize,,,,) = vault.positions(posKey);
        assertEq(posSize, 2_000 * 1e18, "zero-slippage direct trade should not trip the gate");
    }

    function test_Gate_UnsetGuardianRestoresUngatedBehavior() public {
        vault.setCircuitGuardian(address(0));

        // 4x leverage would be rejected by the circuit, but with no guardian the vault's own
        // 5x cap is the only limit — confirming the hook is inert rather than failing closed.
        vm.prank(agent);
        bytes32 posKey = vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 4_000 * 1e18, 1_000 * 1e18);

        (,,, uint256 posSize,,,,) = vault.positions(posKey);
        assertEq(posSize, 4_000 * 1e18, "ungated vault should accept the trade");
    }

    function test_Gate_RevertsWhenVaultNotAuthorizedOnGuardian() public {
        // Deploying the guardian without authorizing the vault is a realistic misconfiguration.
        // It must fail loudly rather than silently letting trades through ungated.
        guardian.setAuthorizedCaller(address(vault), false);

        vm.prank(agent);
        vm.expectRevert(TapeOutCircuitGuardian.Unauthorized.selector);
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 2_000 * 1e18, 1_000 * 1e18);
    }

    function test_Gate_SkippedForPositionRouterCaller() public {
        // A router gates the circuit itself; re-gating here would double-count the cooldown
        // latch against one trade. Treat `agent` as a router to prove the bypass.
        vault.setPositionRouter(agent, true);

        vm.prank(agent);
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 4_000 * 1e18, 1_000 * 1e18);

        // Circuit never ran, so no execution timestamp was recorded for this caller.
        assertEq(guardian.lastTradeTime(agent), 0, "router path should not touch the guardian");
    }

    // =========================================================================
    // DEPLOYED-CONFIGURATION REACHABILITY
    //
    // The tests above deliberately invert the real ordering (5x vault cap, 3x circuit ceiling)
    // so each comparator can be exercised in isolation. That proves the gate WORKS but says
    // nothing about whether the SHIPPED configuration can ever reach it — ViperVault checks
    // `market.maxLeverageBps` before calling _evaluateCircuit, so a market cap at or below the
    // circuit ceiling makes the leverage comparator dead code on the live deployment.
    //
    // These two tests pin the deploy script's actual relationship instead of the test fixture's.
    // =========================================================================

    /// @dev Mirrors DeployVaultWithCircuitXLayer: ceiling x100, headroom in vault bps.
    uint32 constant DEPLOY_MAX_LEVERAGE_RATIO = 2000; // 20.0x
    uint256 constant DEPLOY_HEADROOM_BPS = 50000; // +5x

    function _deployConfiguredMarket() private returns (bytes32 marketId, uint256 marketCapBps) {
        marketCapBps = (uint256(DEPLOY_MAX_LEVERAGE_RATIO) * 100) + DEPLOY_HEADROOM_BPS;
        marketId = keccak256("BTC-PERP-DEPLOYCFG");

        pyth.setPrice(marketId, 3000_00000000, -8, 1_00000000);
        vault.addMarket(marketId, marketId, 1_000_000 * 1e18, 1_000_000 * 1e18, 10 * 1e18, marketCapBps, 500);

        // Point the leverage check at the shipped 20.0x circuit rather than the fixture's 3x.
        guardian.setCircuit(ITapeOutCircuitGuardian.Check.LEVERAGE, address(tapeoutCpu), _tapeoutCircuit("leverage_le"));
        string memory json = vm.readFile("tapeout/circuits/leverage_le.json");
        assertEq(vm.parseJsonUint(json, ".max"), DEPLOY_MAX_LEVERAGE_RATIO, "shipped circuit ceiling drifted");
    }

    function test_DeployedConfig_MarketCapLeavesCircuitReachable() public {
        (, uint256 marketCapBps) = _deployConfiguredMarket();

        // Both sides expressed as plain leverage multiples, so the comparison is legible:
        // the vault must permit strictly MORE leverage than the circuit allows, or the
        // circuit's leverage comparator can never be the thing that rejects a trade.
        uint256 vaultCapX = marketCapBps / 10000; // bps -> x
        uint256 circuitCeilingX = uint256(DEPLOY_MAX_LEVERAGE_RATIO) / 100; // x100 -> x

        assertEq(vaultCapX, 25, "deployed vault cap should be 25x");
        assertEq(circuitCeilingX, 20, "deployed circuit ceiling should be 20x");
        assertGt(vaultCapX, circuitCeilingX, "vault cap must exceed circuit ceiling or the gate is dead code");
    }

    function test_DeployedConfig_LeverageBreachAttributedToCircuit() public {
        (bytes32 marketId,) = _deployConfiguredMarket();

        // 22x: inside the vault's 25x cap, beyond the circuit's 20x ceiling. On the shipped
        // configuration this must revert from the CIRCUIT with diagnostic bit 1 — not from the
        // vault's own MaxLeverageExceeded, which would mean the circuit never ran.
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ViperVault.CircuitRiskRejected.selector, DIAG_LEVERAGE));
        vault.openPosition(marketId, IViperVault.PositionSide.LONG, 22_000 * 1e18, 1_000 * 1e18);
    }
}
