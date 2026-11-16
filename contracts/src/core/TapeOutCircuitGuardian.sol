// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ITapeOutFactory, ITapeOutProcessor } from "../interfaces/ITapeOut.sol";
import { ITapeOutCircuitGuardian } from "../interfaces/ITapeOutCircuitGuardian.sol";
import { IPositionRouter } from "../interfaces/IPositionRouter.sol";
import { IViperVault } from "../interfaces/IViperVault.sol";
import { TapeOutSignal } from "../libraries/TapeOutSignal.sol";

/**
 * @title TapeOutCircuitGuardian
 * @notice Gates ViperX trades on four TapeOut circuits (TAP-02 NAND netlists) taped out to processors
 *         created by the TapeOut factory. Every check is a `processor.eval` call; this contract holds
 *         no thresholds of its own — each limit lives inside its circuit's netlist on chain.
 *
 *         Signals are computed at full width and SATURATED to each circuit's input width
 *         (TapeOutSignal.encode), never truncated, so an oversized value cannot wrap to a small one.
 *
 *         With no circuits set the guardian is inactive and passes every trade (the vault's own limits
 *         still apply). With some but not all four set it reverts, so a half-configured gate fails
 *         loudly instead of silently skipping a check.
 */
contract TapeOutCircuitGuardian is ITapeOutCircuitGuardian, Ownable {
    struct CircuitRef {
        ITapeOutProcessor processor;
        uint256 circuitId;
        uint32 nIn;
    }

    uint256 public constant CHECK_COUNT = 4;

    /// @notice Only processors this factory reports as its own (`isCPU`) can be set.
    ITapeOutFactory public immutable tapeoutFactory;
    address public positionRouter;

    CircuitRef[CHECK_COUNT] internal _circuits;
    uint256 public configuredCount;

    mapping(address => uint256) public lastTradeTime;
    mapping(address => uint32) public agentDrawdownBps;

    /// @notice Contracts other than `positionRouter` permitted to evaluate the circuits — notably
    ///         ViperVault, which traders call directly without going through the router.
    mapping(address => bool) public isAuthorizedCaller;

    event AuthorizedCallerSet(address indexed caller, bool allowed);

    error Unauthorized();
    error InvalidFactory();
    error NotTapeOutProcessor(address processor);
    /// @dev The guardian evaluates one combinational beat: exactly one output, no latch state.
    error UnsupportedCircuit(address processor, uint256 circuitId, uint32 nIn, uint32 nOut, uint32 nState);
    error IncompleteCircuitSet(uint256 configured);

    modifier onlyRouterOrOwner() {
        if (msg.sender != positionRouter && msg.sender != owner() && !isAuthorizedCaller[msg.sender]) {
            revert Unauthorized();
        }
        _;
    }

    constructor(address _tapeoutFactory, address _positionRouter) Ownable(msg.sender) {
        if (_tapeoutFactory == address(0)) revert InvalidFactory();
        tapeoutFactory = ITapeOutFactory(_tapeoutFactory);
        positionRouter = _positionRouter;
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    /**
     * @notice Points one check at a taped-out circuit. The processor must be the factory's, and the
     *         circuit must be combinational with a single output. Its width is read from chain.
     */
    function setCircuit(Check check, address processor, uint256 circuitId) external onlyOwner {
        if (!tapeoutFactory.isCPU(processor)) revert NotTapeOutProcessor(processor);
        (uint32 nIn, uint32 nOut, uint32 nState,) = ITapeOutProcessor(processor).circuitInfo(circuitId);
        if (nIn == 0 || nIn > 256 || nOut != 1 || nState != 0) {
            revert UnsupportedCircuit(processor, circuitId, nIn, nOut, nState);
        }
        CircuitRef storage ref = _circuits[uint8(check)];
        if (address(ref.processor) == address(0)) configuredCount++;
        ref.processor = ITapeOutProcessor(processor);
        ref.circuitId = circuitId;
        ref.nIn = nIn;
        emit CircuitSet(check, processor, circuitId, nIn);
    }

    function clearCircuit(Check check) external onlyOwner {
        if (address(_circuits[uint8(check)].processor) == address(0)) return;
        delete _circuits[uint8(check)];
        configuredCount--;
        emit CircuitCleared(check);
    }

    function circuitFor(Check check) external view returns (address processor, uint256 circuitId, uint32 nIn) {
        CircuitRef storage ref = _circuits[uint8(check)];
        return (address(ref.processor), ref.circuitId, ref.nIn);
    }

    function setPositionRouter(address _positionRouter) external onlyOwner {
        positionRouter = _positionRouter;
    }

    /**
     * @notice Authorizes (or revokes) a contract to evaluate the circuits alongside `positionRouter`.
     *         ViperVault is authorized here so trades sent straight to the vault are gated too.
     */
    function setAuthorizedCaller(address caller, bool allowed) external onlyOwner {
        isAuthorizedCaller[caller] = allowed;
        emit AuthorizedCallerSet(caller, allowed);
    }

    function setAgentDrawdown(address agent, uint32 drawdownBps) external onlyRouterOrOwner {
        agentDrawdownBps[agent] = drawdownBps;
    }

    // =========================================================================
    // EVALUATION
    // =========================================================================

    /**
     * @notice Packs the four signals into one word for the CircuitEvaluated event (32 bits each,
     *         leverage in the low bits). Kept for off-chain decoding; the circuits read their own inputs.
     */
    function packSignals(uint32 leverageRatio, uint32 slippageBps, uint32 drawdownBps, uint32 cooldownSeconds)
        public
        pure
        override
        returns (bytes32 inputBus)
    {
        return bytes32(
            uint256(leverageRatio) | (uint256(slippageBps) << 32) | (uint256(drawdownBps) << 64)
                | (uint256(cooldownSeconds) << 96)
        );
    }

    /**
     * @notice Evaluates an agent's order intent on the four TapeOut circuits.
     * @return passed True when every circuit outputs 1.
     * @return diagnosticBits Bit `uint8(check)` set for each check whose circuit output 0.
     * @return inputBus The signals as evaluated, each saturated to 32 bits (see packSignals).
     */
    function validateIntent(IPositionRouter.AgentIntent calldata intent, uint256 markPrice)
        external
        override
        onlyRouterOrOwner
        returns (bool passed, uint32 diagnosticBits, bytes32 inputBus)
    {
        if (configuredCount == 0) return (true, 0, bytes32(0));
        if (configuredCount != CHECK_COUNT) revert IncompleteCircuitSet(configuredCount);

        uint256[CHECK_COUNT] memory signals = computeSignals(intent, markPrice);

        for (uint256 i = 0; i < CHECK_COUNT; ++i) {
            CircuitRef storage ref = _circuits[i];
            bytes memory out = ref.processor.eval(ref.circuitId, TapeOutSignal.encode(signals[i], ref.nIn));
            // Output bit 0 is the circuit's single output (TAP-02 §5). Anything else is a failure.
            if (out.length == 0 || (uint8(out[0]) & 1) == 0) diagnosticBits |= uint32(1 << i);
        }
        passed = diagnosticBits == 0;

        inputBus = packSignals(
            uint32(TapeOutSignal.saturate(signals[0], 32)),
            uint32(TapeOutSignal.saturate(signals[1], 32)),
            uint32(TapeOutSignal.saturate(signals[2], 32)),
            uint32(TapeOutSignal.saturate(signals[3], 32))
        );
        emit CircuitEvaluated(intent.agent, passed, diagnosticBits, inputBus);
    }

    /**
     * @notice The four signals at full width, in `Check` order.
     *         leverage x100, slippage bps beyond mark in the trade's adverse direction, drawdown bps,
     *         seconds since the agent's last recorded trade (max when it has none).
     */
    function computeSignals(IPositionRouter.AgentIntent calldata intent, uint256 markPrice)
        public
        view
        returns (uint256[CHECK_COUNT] memory s)
    {
        // A position with size but no collateral is unbounded leverage, not zero leverage.
        if (intent.collateralUsd > 0) {
            s[uint8(Check.LEVERAGE)] = (intent.sizeUsd * 100) / intent.collateralUsd;
        } else if (intent.sizeUsd > 0) {
            s[uint8(Check.LEVERAGE)] = type(uint256).max;
        }

        if (markPrice > 0) {
            uint256 diff;
            if (intent.side == IViperVault.PositionSide.LONG) {
                if (intent.maxSlippagePrice > markPrice) diff = intent.maxSlippagePrice - markPrice;
            } else {
                if (markPrice > intent.maxSlippagePrice) diff = markPrice - intent.maxSlippagePrice;
            }
            s[uint8(Check.SLIPPAGE)] = (diff * 10000) / markPrice;
        }

        s[uint8(Check.DRAWDOWN)] = agentDrawdownBps[intent.agent];

        uint256 lastTime = lastTradeTime[intent.agent];
        s[uint8(Check.COOLDOWN)] = lastTime == 0 ? type(uint256).max : block.timestamp - lastTime;
    }

    /**
     * @notice Records a successful trade execution timestamp for cooldown tracking.
     */
    function recordExecution(address agent) external override onlyRouterOrOwner {
        lastTradeTime[agent] = block.timestamp;
    }
}
