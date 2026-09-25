// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPyth, PythPrice } from "../interfaces/IPyth.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockPyth
 * @notice Mock Pyth Network oracle for chains/testnets without direct native Pyth deployments.
 */
contract MockPyth is IPyth, Ownable {
    mapping(bytes32 => PythPrice) public prices;

    event PriceUpdated(bytes32 indexed id, int64 price, int32 expo, uint64 conf, uint256 publishTime);

    constructor() Ownable(msg.sender) {}

    function setPrice(bytes32 id, int64 price, int32 expo, uint64 conf) external onlyOwner {
        prices[id] = PythPrice({
            price: price,
            conf: conf,
            expo: expo,
            publishTime: block.timestamp
        });
        emit PriceUpdated(id, price, expo, conf, block.timestamp);
    }

    function getPriceNoOlderThan(bytes32 id, uint256 maxAge) external view override returns (PythPrice memory) {
        PythPrice memory p = prices[id];
        require(p.price > 0, "MockPyth: price not set");
        require(block.timestamp >= p.publishTime, "MockPyth: invalid timestamp");
        if (maxAge > 0) {
            require(block.timestamp - p.publishTime <= maxAge, "MockPyth: price stale");
        }
        return p;
    }

    function getPrice(bytes32 id) external view override returns (PythPrice memory) {
        PythPrice memory p = prices[id];
        require(p.price > 0, "MockPyth: price not set");
        return p;
    }

    function getUpdateFee(bytes[] calldata) external pure override returns (uint256) {
        return 0;
    }

    function updatePriceFeeds(bytes[] calldata) external payable override {}
}
