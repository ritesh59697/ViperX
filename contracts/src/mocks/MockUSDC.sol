// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Testnet 6-decimal USDC with public faucet functionality for OKX X Layer testing.
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;
    uint256 public constant FAUCET_AMOUNT = 10_000 * 1e6; // 10,000 USDC per faucet claim

    mapping(address => uint256) public lastFaucetClaim;

    event FaucetClaimed(address indexed recipient, uint256 amount);

    constructor() ERC20("ViperX Testnet USDC", "USDC") Ownable(msg.sender) {
        // Mint initial supply of 10,000,000 USDC to deployer
        _mint(msg.sender, 10_000_000 * 1e6);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Anyone can claim 10,000 USDC for testing on X Layer
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Custom mint for testing and vault seeding
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
