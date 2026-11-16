// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { TapeOutCircuitFixture } from "./utils/TapeOutCircuitFixture.sol";
import { ViperVault } from "../src/core/ViperVault.sol";
import { PositionRouter } from "../src/core/PositionRouter.sol";
import { PythPriceAdapter } from "../src/core/PythPriceAdapter.sol";
import { TapeOutCircuitGuardian } from "../src/core/TapeOutCircuitGuardian.sol";
import { ITapeOutCircuitGuardian } from "../src/interfaces/ITapeOutCircuitGuardian.sol";
import { IViperVault } from "../src/interfaces/IViperVault.sol";
import { IPositionRouter } from "../src/interfaces/IPositionRouter.sol";
import { MockUSDC, MockPyth } from "./ViperVault.t.sol";
import { MockTapeOutProcessor } from "../src/mocks/MockTapeOut.sol";

contract TapeOutCircuitGuardianTest is TapeOutCircuitFixture {
    MockUSDC public usdc;
    MockPyth public pyth;
    PythPriceAdapter public adapter;
    ViperVault public vault;
    PositionRouter public router;

    TapeOutCircuitGuardian public guardian;

    // Diagnostic bit per check: 1 << uint8(ITapeOutCircuitGuardian.Check.X).
    uint32 constant DIAG_LEVERAGE = 1 << 0;
    uint32 constant DIAG_SLIPPAGE = 1 << 1;
    uint32 constant DIAG_DRAWDOWN = 1 << 2;
    uint32 constant DIAG_COOLDOWN = 1 << 3;

    uint256 public agentPrivateKey = 0xA11CE;
    address public agent;
    address public relayer = address(0x400);

    bytes32 public constant ETH_MARKET = keccak256("ETH-PERP");
    bytes32 public constant ETH_PYTH_FEED = keccak256("ETH-USD-FEED");

    function setUp() public {
        agent = vm.addr(agentPrivateKey);

        usdc = new MockUSDC();
        pyth = new MockPyth();
        adapter = new PythPriceAdapter(address(pyth), 60, 500);
        vault = new ViperVault(address(usdc), 6, address(adapter));
        router = new PositionRouter(address(vault), address(usdc), address(adapter));

        // 1. Tape out the shipped circuits (20.0x, 2.00%, 25.00%, 10s) and wire them into the guardian
        _deployTapeOut();
        guardian = new TapeOutCircuitGuardian(address(tapeoutFactory), address(router));
        _wire(guardian, "leverage_le", "slippage_le", "drawdown_le", "cooldown_ge");
        router.setCircuitGuardian(address(guardian));

        // 3. Configure Market (ETH @ $3,000)
        pyth.setPrice(ETH_PYTH_FEED, 3000_00000000, -8, 1_00000000);
        vault.addMarket(ETH_MARKET, ETH_PYTH_FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 30 * 1e18, 50000, 500);
        vault.setPositionRouter(address(router), true);

        // Seed liquidity
        usdc.mint(address(this), 100_000 * 1e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositLiquidity(50_000 * 1e6);

        // Seed agent
        usdc.mint(agent, 20_000 * 1e6);
        vm.prank(agent);
        usdc.approve(address(router), type(uint256).max);
    }

    function _signIntent(IPositionRouter.AgentIntent memory intent) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                router.AGENT_INTENT_TYPEHASH(),
                intent.agent,
                intent.marketId,
                uint8(intent.side),
                intent.sizeUsd,
                intent.collateralUsd,
                intent.maxSlippagePrice,
                intent.deadline,
                intent.nonce
            )
        );

        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ViperX PositionRouter")),
                keccak256(bytes("1")),
                block.chainid,
                address(router)
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentPrivateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_CircuitGuardian_PassNormalTrade() public {
        IPositionRouter.AgentIntent memory intent = IPositionRouter.AgentIntent({
            agent: agent,
            marketId: ETH_MARKET,
            side: IViperVault.PositionSide.LONG,
            sizeUsd: 3_000 * 1e18, // 3x leverage
            collateralUsd: 1_000 * 1e18,
            maxSlippagePrice: 3030 * 1e18, // 1% slippage tolerance (<= 2%)
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });

        bytes memory signature = _signIntent(intent);

        vm.prank(relayer);
        bytes32 posKey = router.executeAgentIntent(intent, signature);

        (,,IViperVault.PositionSide side, uint256 posSize,,,,) = vault.positions(posKey);
        assertEq(posSize, 3_000 * 1e18);
        assertTrue(side == IViperVault.PositionSide.LONG);
        assertEq(guardian.lastTradeTime(agent), block.timestamp);
    }

    function test_CircuitGuardian_RevertOnLeverageBreach() public {
        // Agent attempts 25x leverage (2500 > 2000 max leverage)
        IPositionRouter.AgentIntent memory intent = IPositionRouter.AgentIntent({
            agent: agent,
            marketId: ETH_MARKET,
            side: IViperVault.PositionSide.LONG,
            sizeUsd: 25_000 * 1e18,
            collateralUsd: 1_000 * 1e18,
            maxSlippagePrice: 3030 * 1e18,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });

        bytes memory signature = _signIntent(intent);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PositionRouter.CircuitRiskRejected.selector, DIAG_LEVERAGE));
        router.executeAgentIntent(intent, signature);
    }

    function test_CircuitGuardian_RevertOnSlippageBreach() public {
        // Mark price is $3,000. Agent allows $3,150 (5% slippage > 2% max threshold)
        IPositionRouter.AgentIntent memory intent = IPositionRouter.AgentIntent({
            agent: agent,
            marketId: ETH_MARKET,
            side: IViperVault.PositionSide.LONG,
            sizeUsd: 3_000 * 1e18,
            collateralUsd: 1_000 * 1e18,
            maxSlippagePrice: 3150 * 1e18,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });

        bytes memory signature = _signIntent(intent);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PositionRouter.CircuitRiskRejected.selector, DIAG_SLIPPAGE));
        router.executeAgentIntent(intent, signature);
    }

    function test_CircuitGuardian_RevertOnAntiWashTradeCooldown() public {
        // 1. First trade passes at t=100
        vm.warp(100);
        IPositionRouter.AgentIntent memory intent1 = IPositionRouter.AgentIntent({
            agent: agent,
            marketId: ETH_MARKET,
            side: IViperVault.PositionSide.LONG,
            sizeUsd: 2_000 * 1e18,
            collateralUsd: 1_000 * 1e18,
            maxSlippagePrice: 3020 * 1e18,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });

        vm.prank(relayer);
        router.executeAgentIntent(intent1, _signIntent(intent1));

        // 2. Second trade 3 seconds later (3s < 10s cooldown latch)
        vm.warp(103);
        IPositionRouter.AgentIntent memory intent2 = IPositionRouter.AgentIntent({
            agent: agent,
            marketId: ETH_MARKET,
            side: IViperVault.PositionSide.LONG,
            sizeUsd: 2_000 * 1e18,
            collateralUsd: 1_000 * 1e18,
            maxSlippagePrice: 3020 * 1e18,
            deadline: block.timestamp + 1 hours,
            nonce: 1
        });

        bytes memory sig2 = _signIntent(intent2);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PositionRouter.CircuitRiskRejected.selector, DIAG_COOLDOWN));
        router.executeAgentIntent(intent2, sig2);

        // 3. Warp past 10s cooldown window (t = 115s > 100 + 10s)
        vm.warp(115);
        vm.prank(relayer);
        bytes32 posKey2 = router.executeAgentIntent(intent2, sig2);
        assertTrue(posKey2 != bytes32(0));
    }

    function test_CircuitGuardian_RevertOnDrawdownKillswitch() public {
        // Set agent drawdown to 30.00% (3000 bps > 2500 bps limit)
        guardian.setAgentDrawdown(agent, 3000);

        IPositionRouter.AgentIntent memory intent = IPositionRouter.AgentIntent({
            agent: agent,
            marketId: ETH_MARKET,
            side: IViperVault.PositionSide.LONG,
            sizeUsd: 2_000 * 1e18,
            collateralUsd: 1_000 * 1e18,
            maxSlippagePrice: 3020 * 1e18,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });

        bytes memory signature = _signIntent(intent);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PositionRouter.CircuitRiskRejected.selector, DIAG_DRAWDOWN));
        router.executeAgentIntent(intent, signature);
    }

    // =========================================================================
    // REAL-CIRCUIT SPECIFICS
    // =========================================================================

    function _intent(uint256 sizeUsd, uint256 collateralUsd) internal view returns (IPositionRouter.AgentIntent memory) {
        return IPositionRouter.AgentIntent({
            agent: agent,
            marketId: ETH_MARKET,
            side: IViperVault.PositionSide.LONG,
            sizeUsd: sizeUsd,
            collateralUsd: collateralUsd,
            maxSlippagePrice: 3000 * 1e18,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });
    }

    /// 655.37x leverage is 65537 x100: truncated to the 16-bit circuit it would read as 1 and pass.
    function test_Guardian_OversizedSignalIsSaturatedNotTruncated() public {
        (bool passed, uint32 diag, bytes32 bus) = guardian.validateIntent(_intent(65_537 * 1e18, 100 * 1e18), 3000 * 1e18);
        assertFalse(passed);
        assertEq(diag, DIAG_LEVERAGE);
        assertEq(uint32(uint256(bus)), 65537, "bus keeps the full value for the event");
    }

    /// Size with zero collateral is unbounded leverage. The old guardian scored it as 0x and passed it.
    function test_Guardian_ZeroCollateralIsMaxLeverage() public {
        (bool passed, uint32 diag,) = guardian.validateIntent(_intent(1_000 * 1e18, 0), 3000 * 1e18);
        assertFalse(passed);
        assertEq(diag, DIAG_LEVERAGE);
    }

    /// Exactly at each limit passes; one past it fails. Pins the comparators' boundaries end to end.
    function test_Guardian_BoundariesInclusive() public {
        (bool passed,,) = guardian.validateIntent(_intent(20_000 * 1e18, 1_000 * 1e18), 3000 * 1e18); // 20.00x
        assertTrue(passed, "20.00x passes");
        (passed,,) = guardian.validateIntent(_intent(20_010 * 1e18, 1_000 * 1e18), 3000 * 1e18); // 20.01x
        assertFalse(passed, "20.01x fails");

        guardian.setAgentDrawdown(agent, 2500);
        (passed,,) = guardian.validateIntent(_intent(2_000 * 1e18, 1_000 * 1e18), 3000 * 1e18);
        assertTrue(passed, "25.00% drawdown passes");
        guardian.setAgentDrawdown(agent, 2501);
        (, uint32 diag,) = guardian.validateIntent(_intent(2_000 * 1e18, 1_000 * 1e18), 3000 * 1e18);
        assertEq(diag, DIAG_DRAWDOWN, "25.01% drawdown fails");
        guardian.setAgentDrawdown(agent, 0);

        vm.warp(1_000);
        guardian.recordExecution(agent);
        vm.warp(1_009);
        (, diag,) = guardian.validateIntent(_intent(2_000 * 1e18, 1_000 * 1e18), 3000 * 1e18);
        assertEq(diag, DIAG_COOLDOWN, "9s fails a 10s floor");
        vm.warp(1_010);
        (passed,,) = guardian.validateIntent(_intent(2_000 * 1e18, 1_000 * 1e18), 3000 * 1e18);
        assertTrue(passed, "10s passes");
    }

    /// Every failing check reports its own bit at once.
    function test_Guardian_ReportsAllBreachesTogether() public {
        guardian.setAgentDrawdown(agent, 9_000);
        vm.warp(1_000);
        guardian.recordExecution(agent);
        IPositionRouter.AgentIntent memory i = _intent(50_000 * 1e18, 1_000 * 1e18);
        i.maxSlippagePrice = 3300 * 1e18; // 10%
        (bool passed, uint32 diag,) = guardian.validateIntent(i, 3000 * 1e18);
        assertFalse(passed);
        assertEq(diag, DIAG_LEVERAGE | DIAG_SLIPPAGE | DIAG_DRAWDOWN | DIAG_COOLDOWN);
    }

    function test_Guardian_InactiveWithNoCircuits() public {
        TapeOutCircuitGuardian bare = new TapeOutCircuitGuardian(address(tapeoutFactory), address(0));
        (bool passed, uint32 diag,) = bare.validateIntent(_intent(90_000 * 1e18, 1_000 * 1e18), 3000 * 1e18);
        assertTrue(passed);
        assertEq(diag, 0);
    }

    function test_Guardian_PartialConfigFailsLoudly() public {
        guardian.clearCircuit(ITapeOutCircuitGuardian.Check.COOLDOWN);
        assertEq(guardian.configuredCount(), 3);
        vm.expectRevert(abi.encodeWithSelector(TapeOutCircuitGuardian.IncompleteCircuitSet.selector, 3));
        guardian.validateIntent(_intent(2_000 * 1e18, 1_000 * 1e18), 3000 * 1e18);
    }

    function test_Guardian_RejectsProcessorNotFromFactory() public {
        MockTapeOutProcessor rogue = new MockTapeOutProcessor();
        vm.expectRevert(abi.encodeWithSelector(TapeOutCircuitGuardian.NotTapeOutProcessor.selector, address(rogue)));
        guardian.setCircuit(ITapeOutCircuitGuardian.Check.LEVERAGE, address(rogue), 1);
    }

    function test_Guardian_RejectsMultiOutputCircuit() public {
        // Two outputs: NAND(in0,in0), NAND(in0,in0) over one input.
        uint256 id = tapeoutCpu.tapeout(hex"0000000200000200000002000002", 1, 2);
        vm.expectRevert(
            abi.encodeWithSelector(TapeOutCircuitGuardian.UnsupportedCircuit.selector, address(tapeoutCpu), id, 1, 2, 0)
        );
        guardian.setCircuit(ITapeOutCircuitGuardian.Check.LEVERAGE, address(tapeoutCpu), id);
    }

    function test_Guardian_OnlyOwnerConfigures() public {
        vm.prank(relayer);
        vm.expectRevert();
        guardian.clearCircuit(ITapeOutCircuitGuardian.Check.LEVERAGE);
    }
}
