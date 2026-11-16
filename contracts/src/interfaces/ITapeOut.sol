// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @notice The real TapeOut protocol contracts, as specified by TAP-02 and TAP-10
 *         (github.com/TapeOutProtocol/TAPs) and deployed on X Layer mainnet (chain 196).
 *         Selectors were checked against the deployed bytecode on 2026-11-13. The X Layer factory
 *         has been upgraded since TAP-10 was written: `createCPU` is no longer payable and instead
 *         pulls `deployFee()` of the `bem()` ERC-20 from the caller, so approve the factory first.
 *
 *         Not to be confused with `ITapeOutCircuitProcessor`, ViperX's earlier self-defined
 *         interface, which no TapeOut contract implements.
 */
interface ITapeOutFactory {
    /// @dev Creates a processor contract (ERC-721 of circuits) with its own transistor token.
    ///      Pulls `deployFee()` of `bem()` from msg.sender. Returns the new processor's
    ///      transistors contract, NOT the processor: read the processor from `cpuAt(cpuCount() - 1)`
    ///      or the `CPUCreated(cpu, transistors, creator)` event.
    function createCPU(
        string calldata name,
        string calldata symbol,
        string calldata story,
        uint256 supplyCap,
        uint256 mintPrice
    ) external returns (address transistors);

    function bem() external view returns (address);
    function deployFee() external view returns (uint256);

    function isCPU(address cpu) external view returns (bool);
    function cpuCount() external view returns (uint256);
    function cpuAt(uint256 i) external view returns (address);
}

interface ITapeOutProcessor {
    function tapeout(bytes calldata netlist, uint32 nIn, uint32 nOut) external payable returns (uint256 id);
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory outputs);
    function step(uint256 id, bytes calldata state, bytes calldata inputs)
        external
        view
        returns (bytes memory newState, bytes memory outputs);
    function circuitInfo(uint256 id) external view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount);
    function netlist(uint256 id) external view returns (bytes memory);
    function nextId() external view returns (uint256);
    function ownerOf(uint256 id) external view returns (address);
    function transistorsContract() external view returns (address);
    function TAPEOUT_FEE() external view returns (uint256);
}

/// @dev ERC-1155 gate supply of one processor. tapeout burns the caller's NAND and LATCH balance.
///      Processors created after the factory upgrade use a transistors implementation whose `mint`
///      is not payable: it pulls `mintPrice() * amount + protocolFee()` of `BEM()` from the caller.
interface ITapeOutTransistors {
    function mint(uint256 id, uint256 amount) external;
    function BEM() external view returns (address);
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function mintPrice() external view returns (uint256);
    function protocolFee() external view returns (uint256);
    function supplyCap() external view returns (uint256);
    function minted() external view returns (uint256);
    function NAND() external view returns (uint256);
    function LATCH() external view returns (uint256);
}
