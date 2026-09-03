// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ViperVault } from "../src/core/ViperVault.sol";
import { PythPriceAdapter } from "../src/core/PythPriceAdapter.sol";
import { IPyth, PythPrice } from "../src/interfaces/IPyth.sol";
import { IViperVault } from "../src/interfaces/IViperVault.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract MockPyth is IPyth {
    mapping(bytes32 => PythPrice) public prices;

    function setPrice(bytes32 id, int64 price, int32 expo, uint64 conf) external {
        prices[id] = PythPrice({
            price: price,
            conf: conf,
            expo: expo,
            publishTime: block.timestamp
        });
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

contract ViperVaultTest is Test {
    MockUSDC public usdc;
    MockPyth public pyth;
    PythPriceAdapter public adapter;
    ViperVault public vault;

    address public owner = address(this);
    address public lp = address(0x100);
    address public agent = address(0x200);
    address public keeper = address(0x300);

    bytes32 public constant ETH_MARKET = keccak256("ETH-PERP");
    bytes32 public constant ETH_PYTH_FEED = keccak256("ETH-USD-FEED");

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth();
        adapter = new PythPriceAdapter(address(pyth), 60, 500); // 60s max staleness, 5% max confidence
        vault = new ViperVault(address(usdc), 6, address(adapter));

        // Configure ETH-PERP market ($3,000 ETH initial price)
        pyth.setPrice(ETH_PYTH_FEED, 3000_00000000, -8, 1_00000000); // $3000.00 (expo -8)
        vault.addMarket(
            ETH_MARKET,
            ETH_PYTH_FEED,
            1_000_000 * 1e18, // $1M max long OI
            1_000_000 * 1e18, // $1M max short OI
            10 * 1e18,        // $10 min size
            50000,            // 5x max leverage (50000 / 10000 = 5x)
            500               // 5% maintenance margin (500 bps)
        );

        // Seed balances
        usdc.mint(lp, 100_000 * 1e6);    // 100,000 USDC
        usdc.mint(agent, 10_000 * 1e6);   // 10,000 USDC

        // LP deposits $50,000 initial liquidity
        vm.startPrank(lp);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositLiquidity(50_000 * 1e6);
        vm.stopPrank();

        vm.startPrank(agent);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    function test_LP_DepositAndWithdraw() public {
        assertEq(vault.totalAssets(), 50_000 * 1e18);
        assertEq(vault.balanceOf(lp), 50_000 * 1e18);

        vm.startPrank(lp);
        uint256 returnedUsdc = vault.withdrawLiquidity(10_000 * 1e18);
        assertEq(returnedUsdc, 10_000 * 1e6);
        assertEq(vault.totalAssets(), 40_000 * 1e18);
        vm.stopPrank();
    }

    function test_OpenAndCloseLongPosition_Profit() public {
        // Agent deposits $1,000 collateral and opens a $3,000 Long position (3x leverage)
        uint256 collateral = 1_000 * 1e18;
        uint256 size = 3_000 * 1e18;

        vm.prank(agent);
        bytes32 posKey = vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, size, collateral);

        (,,IViperVault.PositionSide side, uint256 posSize, uint256 posCollateral, uint256 entryPrice,,) = vault.positions(posKey);
        assertEq(posSize, size);
        assertEq(entryPrice, 3000 * 1e18);
        assertTrue(side == IViperVault.PositionSide.LONG);

        // Price goes up 10% from $3000 to $3300
        pyth.setPrice(ETH_PYTH_FEED, 3300_00000000, -8, 1_00000000);

        uint256 agentBalBefore = usdc.balanceOf(agent);

        // Agent closes position
        vm.prank(agent);
        (int256 pnl, uint256 payout) = vault.closePosition(posKey);

        // 10% gain on $3,000 position = +$300 profit (minus fees)
        assertGt(pnl, 290 * 1e18);
        assertGt(payout, 1290 * 1e18);
        assertGt(usdc.balanceOf(agent), agentBalBefore + 1290 * 1e6);
    }

    function test_OpenAndCloseShortPosition_Profit() public {
        // Agent opens $3,000 Short ETH with $1,000 collateral
        uint256 collateral = 1_000 * 1e18;
        uint256 size = 3_000 * 1e18;

        vm.prank(agent);
        bytes32 posKey = vault.openPosition(ETH_MARKET, IViperVault.PositionSide.SHORT, size, collateral);

        // Price drops 10% from $3000 to $2700
        pyth.setPrice(ETH_PYTH_FEED, 2700_00000000, -8, 1_00000000);

        vm.prank(agent);
        (int256 pnl, uint256 payout) = vault.closePosition(posKey);

        // 10% drop on short = +$300 profit
        assertGt(pnl, 290 * 1e18);
        assertGt(payout, 1290 * 1e18);
    }

    function test_LiquidationWhenUnderwater() public {
        // Agent opens 5x Long: $5,000 size with $1,000 collateral
        uint256 collateral = 1_000 * 1e18;
        uint256 size = 5_000 * 1e18;

        vm.prank(agent);
        bytes32 posKey = vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, size, collateral);

        // Price crashes 20% from $3000 to $2400 (loss = $1000, position insolvent)
        pyth.setPrice(ETH_PYTH_FEED, 2400_00000000, -8, 1_00000000);

        uint256 keeperBalBefore = usdc.balanceOf(keeper);

        // Keeper liquidates the underwater position
        vm.prank(keeper);
        uint256 reward = vault.liquidatePosition(posKey);

        assertGt(reward, 0);
        assertGt(usdc.balanceOf(keeper), keeperBalBefore);

        // Position is now closed / purged
        (,,,uint256 remainingSize,,,,) = vault.positions(posKey);
        assertEq(remainingSize, 0);
    }

    function test_RevertWhen_LeverageExceeded() public {
        // 6x leverage ($6,000 size with $1,000 collateral, max is 5x)
        vm.prank(agent);
        vm.expectRevert();
        vault.openPosition(ETH_MARKET, IViperVault.PositionSide.LONG, 6_000 * 1e18, 1_000 * 1e18);
    }
}
