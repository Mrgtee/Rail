// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMintableToken {
    function mint(address to, uint256 amount) external;
}

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

contract MockRouter {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public rateBps;

    event RateSet(address indexed inputAsset, address indexed outputAsset, uint256 rateBps);
    event SwapExecuted(address indexed owner, address indexed inputAsset, address indexed outputAsset, uint256 amountIn, uint256 amountOut);

    function setRate(address inputAsset, address outputAsset, uint256 rateBps_) external {
        require(rateBps_ > 0, "Rail: rate required");
        rateBps[inputAsset][outputAsset] = rateBps_;
        emit RateSet(inputAsset, outputAsset, rateBps_);
    }

    function execute(address owner, address inputAsset, address outputAsset, uint256 amountIn, bytes calldata) external returns (uint256 amountOut) {
        uint256 rate = rateBps[inputAsset][outputAsset];
        if (rate == 0) {
            rate = 10_000;
        }

        IERC20(inputAsset).safeTransferFrom(msg.sender, address(this), amountIn);
        amountOut = (_normalizeDecimals(inputAsset, outputAsset, amountIn) * rate) / 10_000;
        IMintableToken(outputAsset).mint(msg.sender, amountOut);

        emit SwapExecuted(owner, inputAsset, outputAsset, amountIn, amountOut);
    }

    function _normalizeDecimals(address inputAsset, address outputAsset, uint256 amountIn) internal view returns (uint256) {
        uint8 inputDecimals = IERC20Decimals(inputAsset).decimals();
        uint8 outputDecimals = IERC20Decimals(outputAsset).decimals();

        if (outputDecimals == inputDecimals) {
            return amountIn;
        }

        if (outputDecimals > inputDecimals) {
            return amountIn * (10 ** uint256(outputDecimals - inputDecimals));
        }

        return amountIn / (10 ** uint256(inputDecimals - outputDecimals));
    }
}
