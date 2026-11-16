// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITapeOutFactory, ITapeOutProcessor, ITapeOutTransistors } from "../src/interfaces/ITapeOut.sol";
import { TapeOutWiring } from "./TapeOutWiring.sol";

/**
 * @title TapeOutRiskCircuits
 * @notice Creates one TapeOut processor and tapes the four ViperX risk circuits out to it, on X Layer
 *         mainnet. Every fee is read from chain: the factory's deploy fee and the transistors' mint
 *         and protocol fees in BEM, the processor's TAPEOUT_FEE in OKB per circuit.
 *
 *         The signer needs BEM on X Layer (deploy fee + mint cost) and OKB for 4 x TAPEOUT_FEE + gas.
 *         It must be an EOA: the processor NFT and gate tokens are sent to it.
 *
 *         Signing: --account <name> --sender <addr> (keystore), or PRIVATE_KEY in env.
 *         Required env: TAPEOUT_FACTORY_XLAYER, TAPEOUT_CPU_NAME, TAPEOUT_CPU_SYMBOL, TAPEOUT_CPU_STORY.
 *         Optional env: TAPEOUT_MINT_PRICE (BEM per gate others pay to mint from this processor; default 0),
 *                       TAPEOUT_<CHECK>_CIRCUIT (see TapeOutWiring.sol).
 *         Prints the TAPEOUT_<CHECK>_CPU / _ID lines the deploy scripts read.
 */
contract TapeOutRiskCircuits is TapeOutWiring {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        ITapeOutFactory factory = ITapeOutFactory(vm.envAddress("TAPEOUT_FACTORY_XLAYER"));
        string memory name = vm.envString("TAPEOUT_CPU_NAME");
        string memory symbol = vm.envString("TAPEOUT_CPU_SYMBOL");
        string memory story = vm.envString("TAPEOUT_CPU_STORY");
        uint256 mintPrice = vm.envOr("TAPEOUT_MINT_PRICE", uint256(0));

        bytes[4] memory netlists;
        uint32[4] memory nIns;
        uint32[4] memory nOuts;
        uint256 totalGates;
        for (uint256 i = 0; i < 4; i++) {
            (, string memory json) = _circuitFile(i);
            netlists[i] = vm.parseJsonBytes(json, ".netlist");
            nIns[i] = uint32(vm.parseJsonUint(json, ".nIn"));
            nOuts[i] = uint32(vm.parseJsonUint(json, ".nOut"));
            totalGates += vm.parseJsonUint(json, ".gates");
        }
        console2.log("Total NAND gates:", totalGates);

        if (deployerPrivateKey == 0) vm.startBroadcast();
        else vm.startBroadcast(deployerPrivateKey);

        IERC20 bem = IERC20(factory.bem());
        uint256 index = factory.cpuCount();
        bem.approve(address(factory), factory.deployFee());
        ITapeOutTransistors t = ITapeOutTransistors(factory.createCPU(name, symbol, story, totalGates, mintPrice));
        ITapeOutProcessor cpu = ITapeOutProcessor(factory.cpuAt(index));
        require(cpu.transistorsContract() == address(t), "processor/transistors mismatch");

        uint256 mintCost = t.mintPrice() * totalGates + t.protocolFee();
        bem.approve(address(t), mintCost);
        t.mint(t.NAND(), totalGates);

        uint256[4] memory ids;
        uint256 fee = cpu.TAPEOUT_FEE();
        for (uint256 i = 0; i < 4; i++) {
            ids[i] = cpu.tapeout{ value: fee }(netlists[i], nIns[i], nOuts[i]);
        }
        vm.stopBroadcast();

        console2.log("Processor:", address(cpu));
        console2.log("BEM mint cost (8 decimals):", mintCost);
        for (uint256 i = 0; i < 4; i++) {
            require(keccak256(cpu.netlist(ids[i])) == keccak256(netlists[i]), "stored netlist differs");
            console2.log(string.concat("TAPEOUT_", CHECK_NAMES[i], "_CPU="), address(cpu));
            console2.log(string.concat("TAPEOUT_", CHECK_NAMES[i], "_ID="), ids[i]);
        }
    }
}
