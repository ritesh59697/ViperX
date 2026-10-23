// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { ViperVault } from "../src/core/ViperVault.sol";
import { PositionRouter } from "../src/core/PositionRouter.sol";
import { PythPriceAdapter } from "../src/core/PythPriceAdapter.sol";
import { TapeOutCircuitGuardian } from "../src/core/TapeOutCircuitGuardian.sol";
import { MockTapeOutProcessor } from "../src/mocks/MockTapeOutProcessor.sol";
import { IViperVault } from "../src/interfaces/IViperVault.sol";
import { IPositionRouter } from "../src/interfaces/IPositionRouter.sol";
import { MockUSDC, MockPyth } from "./ViperVault.t.sol";

contract TapeOutCircuitGuardianTest is Test {
    MockUSDC public usdc;
    MockPyth public pyth;
    PythPriceAdapter public adapter;
    ViperVault public vault;
    PositionRouter public router;

    MockTapeOutProcessor public processor;
    TapeOutCircuitGuardian public guardian;

    uint256 public constant CIRCUIT_VIPER_RISK = 101;

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

        // 1. Deploy TapeOut Hardware Processor & Register Circuit
        processor = new MockTapeOutProcessor();
        processor.registerCircuit({
            circuitId: CIRCUIT_VIPER_RISK,
            maxLeverageRatio: 2000,     // 20.0x max leverage
            maxSlippageBps: 200,        // 2.00% max slippage tolerance
            maxDrawdownBps: 2500,       // 25.00% max drawdown limit
            minCooldownSeconds: 10      // 10s anti-wash trading latch
        });

        // 2. Deploy Adapter & Connect to Router
        guardian = new TapeOutCircuitGuardian(
            address(processor),
            CIRCUIT_VIPER_RISK,
            address(router)
        );
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
        vm.expectRevert(abi.encodeWithSelector(PositionRouter.CircuitRiskRejected.selector, processor.DIAG_LEVERAGE_BREACH()));
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
        vm.expectRevert(abi.encodeWithSelector(PositionRouter.CircuitRiskRejected.selector, processor.DIAG_SLIPPAGE_BREACH()));
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
        vm.expectRevert(abi.encodeWithSelector(PositionRouter.CircuitRiskRejected.selector, processor.DIAG_COOLDOWN_BREACH()));
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
        vm.expectRevert(abi.encodeWithSelector(PositionRouter.CircuitRiskRejected.selector, processor.DIAG_DRAWDOWN_BREACH()));
        router.executeAgentIntent(intent, signature);
    }
}
