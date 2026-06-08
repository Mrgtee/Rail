// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    uint8 private immutable tokenDecimals;
    mapping(address => bool) public minters;

    event MinterSet(address indexed minter, bool allowed);
    event FaucetMinted(address indexed receiver, uint256 amount);

    modifier onlyMinterOrOwner() {
        require(owner() == msg.sender || minters[msg.sender], "Rail: not minter");
        _;
    }

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) Ownable(msg.sender) {
        tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        require(minter != address(0), "Rail: minter required");
        minters[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    function mint(address to, uint256 amount) external onlyMinterOrOwner {
        require(to != address(0), "Rail: receiver required");
        _mint(to, amount);
    }

    function faucet(uint256 amount) external {
        require(amount > 0, "Rail: amount required");
        _mint(msg.sender, amount);
        emit FaucetMinted(msg.sender, amount);
    }
}
