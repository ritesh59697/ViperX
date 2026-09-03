// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { ViperVault } from "../src/core/ViperVault.sol";
import { PositionRouter } from "../src/core/PositionRouter.sol";
import { PythPriceAdapter } from "../src/core/PythPriceAdapter.sol";
import { IViperVault } from "../src/interfaces/IViperVault.sol";
import { IPositionRouter } from "../src/interfaces/IPositionRouter.sol";
import { MockUSDC, MockPyth } from "./ViperVault.t.sol";

contract PositionRouterTest is Test {
    MockUSDC public usdc;
    MockPyth public pyth;
    PythPriceAdapter public adapter;
    ViperVault public vault;
    PositionRouter public router;

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

        // Initial price $3,000
        pyth.setPrice(ETH_PYTH_FEED, 3000_00000000, -8, 1_00000000);
        vault.addMarket(ETH_MARKET, ETH_PYTH_FEED, 1_000_000 * 1e18, 1_000_000 * 1e18, 10 * 1e18, 50000, 500);
        vault.setPositionRouter(address(router), true);

        // Seed liquidity
        usdc.mint(address(this), 100_000 * 1e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositLiquidity(50_000 * 1e6);

        // Seed agent
        usdc.mint(agent, 10_000 * 1e6);
        vm.prank(agent);
        usdc.approve(address(router), type(uint256).max);
    }

    function test_EIP712_AgentIntentExecution() public {
        // Agent constructs a signed intent for 3x Long ETH
        IPositionRouter.AgentIntent memory intent = IPositionRouter.AgentIntent({
            agent: agent,
            marketId: ETH_MARKET,
            side: IViperVault.PositionSide.LONG,
            sizeUsd: 3_000 * 1e18,
            collateralUsd: 1_000 * 1e18,
            maxSlippagePrice: 3050 * 1e18, // slippage limit $3,050
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });

        // Compute EIP-712 digest
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

        // EIP-712 domain separator from PositionRouter
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
        bytes memory signature = abi.encodePacked(r, s, v);

        // Relayer submits the intent on-chain
        vm.prank(relayer);
        bytes32 posKey = router.executeAgentIntent(intent, signature);

        // Verify position was created in vault
        (,,IViperVault.PositionSide side, uint256 posSize,,,,) = vault.positions(posKey);
        assertEq(posSize, 3_000 * 1e18);
        assertTrue(side == IViperVault.PositionSide.LONG);
        assertEq(router.agentNonces(agent), 1);
    }

    function test_StopLossTriggerOrder() public {
        // Agent opens a Long directly on vault
        vm.startPrank(agent);
        usdc.approve(address(vault), type(uint256).max);
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 3_000 * 1e18, 1_000 * 1e18);

        // Agent creates a Stop-Loss trigger order at $2,800
        bytes32 orderId = router.createTriggerOrder(
            ETH_MARKET,
            IViperVault.PositionSide.LONG,
            IPositionRouter.OrderType.STOP_LOSS,
            2800 * 1e18, // trigger price
            3_000 * 1e18,
            1_000 * 1e18,
            true // close position
        );
        vm.stopPrank();

        // Price is still $3000 -> cannot execute trigger yet
        vm.prank(relayer);
        vm.expectRevert();
        router.executeTriggerOrder(orderId);

        // Price drops to $2750 -> Stop-Loss condition met!
        pyth.setPrice(ETH_PYTH_FEED, 2750_00000000, -8, 1_00000000);

        vm.prank(relayer);
        router.executeTriggerOrder(orderId);

        // Order executed and position closed
        bytes32 posKey = vault.getPositionKey(agent, ETH_MARKET, IViperVault.PositionSide.LONG);
        (,,,uint256 remainingSize,,,,) = vault.positions(posKey);
        assertEq(remainingSize, 0);
    }
}
