// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IMintableToken {
    function mint(address to, uint256 amount) external;
}

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

contract MockRouter is Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant PRICE_SCALE = 1e8;
    mapping(address => uint256) public priceUsdE8;

    event PriceSet(address indexed asset, uint256 priceUsdE8);
    event SwapExecuted(address indexed owner, address indexed inputAsset, address indexed outputAsset, uint256 amountIn, uint256 amountOut);

    constructor() Ownable(msg.sender) {}

    function setPrice(address asset, uint256 assetPriceUsdE8) external onlyOwner {
        require(asset != address(0), "Rail: asset required");
        require(assetPriceUsdE8 > 0, "Rail: price required");
        priceUsdE8[asset] = assetPriceUsdE8;
        emit PriceSet(asset, assetPriceUsdE8);
    }

    function quote(address inputAsset, address outputAsset, uint256 amountIn) public view returns (uint256 amountOut) {
        require(amountIn > 0, "Rail: amount required");
        uint256 inputPrice = priceUsdE8[inputAsset];
        uint256 outputPrice = priceUsdE8[outputAsset];
        require(inputPrice > 0 && outputPrice > 0, "Rail: price missing");

        uint8 inputDecimals = IERC20Decimals(inputAsset).decimals();
        uint8 outputDecimals = IERC20Decimals(outputAsset).decimals();
        uint256 inputScale = 10 ** uint256(inputDecimals);
        uint256 outputScale = 10 ** uint256(outputDecimals);
        uint256 valueUsdE8 = (amountIn * inputPrice) / inputScale;
        amountOut = (valueUsdE8 * outputScale) / outputPrice;
    }

    function execute(address owner, address inputAsset, address outputAsset, uint256 amountIn, bytes calldata) external returns (uint256 amountOut) {
        IERC20(inputAsset).safeTransferFrom(msg.sender, address(this), amountIn);
        amountOut = quote(inputAsset, outputAsset, amountIn);
        IMintableToken(outputAsset).mint(msg.sender, amountOut);

        emit SwapExecuted(owner, inputAsset, outputAsset, amountIn, amountOut);
    }
}
