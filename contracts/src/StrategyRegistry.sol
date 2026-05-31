// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract StrategyRegistry is Ownable {
    struct Strategy {
        string name;
        string metadataURI;
        bool enabled;
    }

    mapping(bytes32 => Strategy) public strategies;
    bytes32[] public strategyIds;

    event StrategySet(bytes32 indexed strategyId, string name, bool enabled);

    constructor() Ownable(msg.sender) {}

    function setStrategy(bytes32 strategyId, string calldata name, string calldata metadataURI, bool enabled) external onlyOwner {
        if (bytes(strategies[strategyId].name).length == 0) {
            strategyIds.push(strategyId);
        }

        strategies[strategyId] = Strategy({name: name, metadataURI: metadataURI, enabled: enabled});
        emit StrategySet(strategyId, name, enabled);
    }

    function isEnabled(bytes32 strategyId) external view returns (bool) {
        return strategies[strategyId].enabled;
    }

    function strategyCount() external view returns (uint256) {
        return strategyIds.length;
    }
}
