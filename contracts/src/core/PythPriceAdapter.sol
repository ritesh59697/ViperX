// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPyth, PythPrice } from "../interfaces/IPyth.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract PythPriceAdapter is Ownable {
    IPyth public pyth;
    uint256 public maxStalenessSeconds;
    uint256 public maxConfidenceRatioBps; // Max (conf / price) in basis points (10000 = 100%, 200 = 2%)

    error PriceStale(uint256 publishTime, uint256 maxAge);
    error InvalidPrice(int64 rawPrice);
    error ConfidenceTooWide(uint64 conf, int64 price);

    constructor(address _pyth, uint256 _maxStaleness, uint256 _maxConfidenceRatioBps) Ownable(msg.sender) {
        pyth = IPyth(_pyth);
        maxStalenessSeconds = _maxStaleness;
        maxConfidenceRatioBps = _maxConfidenceRatioBps;
    }

    function setPyth(address _pyth) external onlyOwner {
        pyth = IPyth(_pyth);
    }

    function setMaxStaleness(uint256 _maxStaleness) external onlyOwner {
        maxStalenessSeconds = _maxStaleness;
    }

    function setMaxConfidenceRatioBps(uint256 _maxConfidenceRatioBps) external onlyOwner {
        maxConfidenceRatioBps = _maxConfidenceRatioBps;
    }

    /**
     * @notice Returns the asset price scaled to 18 decimal places (1e18 = $1.00 USD).
     * @param feedId Pyth Price Feed ID.
     */
    function getNormalizedPrice(bytes32 feedId) public view returns (uint256 priceUsd18) {
        PythPrice memory p = pyth.getPriceNoOlderThan(feedId, maxStalenessSeconds);

        if (p.price <= 0) revert InvalidPrice(p.price);

        // Check confidence interval sanity
        uint256 confRatio = (uint256(p.conf) * 10000) / uint256(int256(p.price));
        if (confRatio > maxConfidenceRatioBps) revert ConfidenceTooWide(p.conf, p.price);

        // Convert raw Pyth price + expo into 18-decimal fixed point
        uint256 rawVal = uint256(int256(p.price));
        if (p.expo < 0) {
            uint256 negExpo = uint256(int256(-p.expo));
            if (negExpo <= 18) {
                priceUsd18 = rawVal * (10 ** (18 - negExpo));
            } else {
                priceUsd18 = rawVal / (10 ** (negExpo - 18));
            }
        } else {
            priceUsd18 = rawVal * (10 ** (18 + uint256(int256(p.expo))));
        }
    }
}
