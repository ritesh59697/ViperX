// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITapeOutFactory, ITapeOutProcessor, ITapeOutTransistors } from "../../src/interfaces/ITapeOut.sol";
import { TapeOutSignal } from "../../src/libraries/TapeOutSignal.sol";

/// @dev A contract-side caller, proving a ViperX contract can evaluate a TapeOut circuit in-line.
contract TapeOutEvalProbe {
    function evalWithGas(ITapeOutProcessor cpu, uint256 id, bytes calldata inputs)
        external
        view
        returns (bytes memory outputs, uint256 gasUsed)
    {
        uint256 start = gasleft();
        outputs = cpu.eval(id, inputs);
        gasUsed = start - gasleft();
    }
}

/**
 * @notice End-to-end TapeOut spike against a fork of X Layer mainnet: create a processor, mint
 *         NAND gates, tape out a generated netlist, and evaluate it from a contract.
 *
 *         Run:  TAPEOUT_FACTORY_XLAYER=<factory> forge test --match-path test/fork/TapeOutSpike.fork.t.sol -vv
 *         Skipped when TAPEOUT_FACTORY_XLAYER is unset, so plain `forge test` stays offline.
 *         Circuits come from `python3 tapeout/gen_comparator.py ...` (see tapeout/circuits/).
 */
contract TapeOutSpikeForkTest is Test {
    ITapeOutFactory internal factory;
    address internal operator; // an EOA: ERC-1155 mints to a contract without a receiver hook revert
    TapeOutEvalProbe internal probe;

    function setUp() public {
        address factoryAddr = vm.envOr("TAPEOUT_FACTORY_XLAYER", address(0));
        if (factoryAddr == address(0)) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(vm.rpcUrl(vm.envOr("TAPEOUT_FORK_RPC_ALIAS", string("xlayer_mainnet"))));
        factory = ITapeOutFactory(factoryAddr);
        operator = makeAddr("tapeout-operator");
        vm.deal(operator, 1 ether);
        probe = new TapeOutEvalProbe();
    }

    function test_Spike_LeverageComparator() public {
        _runCircuit("leverage_le");
    }

    function test_Spike_Comparator32() public {
        _runCircuit("spike_le32");
    }

    function test_Spike_SlippageComparator() public {
        _runCircuit("slippage_le");
    }

    function test_Spike_DrawdownComparator() public {
        _runCircuit("drawdown_le");
    }

    function test_Spike_CooldownFloor() public {
        _runCircuit("cooldown_ge");
    }

    struct Circuit {
        string name;
        bytes netlist;
        uint32 nIn;
        uint32 nOut;
        uint256 gates;
        bytes[] inputs;
        bytes[] outputs;
        bool isFloor; // PASS = x >= threshold; otherwise PASS = x <= threshold
        uint256 threshold;
    }

    struct Run {
        ITapeOutProcessor cpu;
        uint256 id;
        uint256 gasCreate;
        uint256 gasMint;
        uint256 gasTapeout;
        uint256 mintValue;
        uint256 tapeoutFee;
        uint256 bemFee;
    }

    function _runCircuit(string memory name) internal {
        Circuit memory c = _load(name);
        uint256 okbBefore = operator.balance;
        // Fees are charged in BEM: the factory's deploy fee, then the transistors' mint fee. The mint
        // fee is only readable once the processor exists, so fund the deploy fee here and top up later.
        IERC20 bem = IERC20(factory.bem());
        deal(address(bem), operator, factory.deployFee());
        Run memory r = _tapeout(c);
        assertEq(bem.balanceOf(operator), 0, "BEM fees not fully charged");
        uint256 maxEvalGas = _checkVectors(c, r);
        uint256 saturatedChecked = _checkSaturated(c, r);

        console2.log("circuit", c.name);
        console2.log("  processor", address(r.cpu));
        console2.log("  circuit id", r.id);
        console2.log("  gates", c.gates);
        console2.log("  vectors matched on chain", c.inputs.length);
        console2.log("  out-of-range values saturated and matched", saturatedChecked);
        console2.log("  gas: createCPU / mint / tapeout", r.gasCreate, r.gasMint, r.gasTapeout);
        console2.log("  gas: eval (max, incl. call)", maxEvalGas);
        console2.log("  BEM mint fee (8 decimals)", r.mintValue);
        console2.log("  OKB tapeout fee (wei)", r.tapeoutFee);
        console2.log("  OKB value paid total (wei)", okbBefore - operator.balance);
        console2.log("  BEM deploy fee (8 decimals)", r.bemFee);
    }

    function _load(string memory name) internal view returns (Circuit memory c) {
        string memory json = vm.readFile(string.concat("tapeout/circuits/", name, ".json"));
        c.name = name;
        c.netlist = vm.parseJsonBytes(json, ".netlist");
        c.nIn = uint32(vm.parseJsonUint(json, ".nIn"));
        c.nOut = uint32(vm.parseJsonUint(json, ".nOut"));
        c.gates = vm.parseJsonUint(json, ".gates");
        c.inputs = vm.parseJsonBytesArray(json, ".inputs");
        c.outputs = vm.parseJsonBytesArray(json, ".outputs");
        assertEq(c.inputs.length, c.outputs.length, "vector file malformed");
        c.isFloor = !vm.keyExistsJson(json, ".max");
        c.threshold = vm.parseJsonUint(json, c.isFloor ? ".min" : ".max");
    }

    function _tapeout(Circuit memory c) internal returns (Run memory r) {
        vm.startPrank(operator, operator);

        // 1. Processor: free mint price, cap sized to the circuit.
        uint256 countBefore = factory.cpuCount();
        r.bemFee = factory.deployFee();
        IERC20(factory.bem()).approve(address(factory), r.bemFee);
        uint256 g0 = gasleft();
        ITapeOutTransistors t =
            ITapeOutTransistors(factory.createCPU("ViperX Risk", "VXR", "spike", c.gates, 0));
        r.gasCreate = g0 - gasleft();
        assertEq(factory.cpuCount(), countBefore + 1, "cpuCount did not advance");
        r.cpu = ITapeOutProcessor(factory.cpuAt(countBefore));
        assertTrue(factory.isCPU(address(r.cpu)), "factory does not recognise the processor");
        assertEq(r.cpu.transistorsContract(), address(t), "createCPU returned another transistors contract");

        // 2. Gates.
        assertEq(t.mintPrice(), 0, "createCPU argument order: mintPrice");
        assertEq(t.supplyCap(), c.gates, "createCPU argument order: supplyCap");
        uint256 nandId = t.NAND();
        assertEq(t.BEM(), factory.bem(), "transistors charge a different token than the factory");
        r.mintValue = t.mintPrice() * c.gates + t.protocolFee();
        deal(t.BEM(), operator, r.mintValue);
        IERC20(t.BEM()).approve(address(t), r.mintValue);
        g0 = gasleft();
        t.mint(nandId, c.gates);
        r.gasMint = g0 - gasleft();
        assertEq(t.balanceOf(operator, nandId), c.gates, "NAND balance after mint");

        // 3. Tape-out.
        r.tapeoutFee = r.cpu.TAPEOUT_FEE();
        g0 = gasleft();
        r.id = r.cpu.tapeout{ value: r.tapeoutFee }(c.netlist, c.nIn, c.nOut);
        r.gasTapeout = g0 - gasleft();
        vm.stopPrank();

        assertEq(t.balanceOf(operator, nandId), 0, "tapeout did not burn the gates");
        assertEq(r.cpu.ownerOf(r.id), operator, "circuit NFT owner");
        assertEq(keccak256(r.cpu.netlist(r.id)), keccak256(c.netlist), "stored netlist differs");
        (uint32 gotIn, uint32 gotOut, uint32 nState, uint32 gateCount) = r.cpu.circuitInfo(r.id);
        assertEq(gotIn, c.nIn, "nIn");
        assertEq(gotOut, c.nOut, "nOut");
        assertEq(nState, 0, "comparator must be combinational");
        assertEq(gateCount, c.gates, "gate count");
    }

    /// 4. Evaluate every vector from a contract and compare with the reference evaluator's output.
    function _checkVectors(Circuit memory c, Run memory r) internal view returns (uint256 maxEvalGas) {
        for (uint256 i = 0; i < c.inputs.length; i++) {
            (bytes memory got, uint256 g) = probe.evalWithGas(r.cpu, r.id, c.inputs[i]);
            assertEq(got, c.outputs[i], string.concat("vector ", vm.toString(i)));
            if (g > maxEvalGas) maxEvalGas = g;
        }
    }

    /// Values wider than the circuit, encoded the way the guardian will (TapeOutSignal.encode),
    /// must get the same verdict as the true integer comparison. The `top + 1 + threshold` case is
    /// the truncation bypass: cut to nIn bits it would read as exactly the threshold.
    function _checkSaturated(Circuit memory c, Run memory r) internal view returns (uint256 n) {
        (uint32 nIn,,,) = r.cpu.circuitInfo(r.id);
        assertEq(nIn, c.nIn, "on-chain width differs from file");
        uint256 top = (uint256(1) << nIn) - 1;
        uint256[8] memory xs = [
            top - 1, top, top + 1, top + 1 + c.threshold, top + c.threshold,
            (top + 1) * 7 + c.threshold, uint256(type(uint32).max), type(uint256).max
        ];
        for (uint256 i = 0; i < xs.length; i++) {
            bool pass = c.isFloor ? xs[i] >= c.threshold : xs[i] <= c.threshold;
            (bytes memory got,) = probe.evalWithGas(r.cpu, r.id, TapeOutSignal.encode(xs[i], nIn));
            assertEq(got, pass ? bytes(hex"01") : bytes(hex"00"), string.concat("saturated ", vm.toString(xs[i])));
            n++;
        }
    }
}
