// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PolicyVault} from "./PolicyVault.sol";

contract AgentExecutor is Ownable {
    PolicyVault public immutable vault;
    mapping(address => bool) public authorizedAgents;

    event AgentSet(address indexed agent, bool allowed);
    event AgentExecutionSubmitted(uint256 indexed policyId, address indexed agent, bool executed, string reason);

    modifier onlyAgent() {
        require(authorizedAgents[msg.sender], "Rail: agent not authorized");
        _;
    }

    constructor(PolicyVault vault_, address initialAgent) Ownable(msg.sender) {
        require(address(vault_) != address(0), "Rail: vault required");
        vault = vault_;
        if (initialAgent != address(0)) {
            authorizedAgents[initialAgent] = true;
            emit AgentSet(initialAgent, true);
        }
    }

    function setAgent(address agent, bool allowed) external onlyOwner {
        authorizedAgents[agent] = allowed;
        emit AgentSet(agent, allowed);
    }

    function execute(
        uint256 policyId,
        address router,
        uint256 amountIn,
        uint16 quotedSlippageBps,
        uint256 projectedReserve,
        bytes calldata data
    ) external onlyAgent returns (uint256 amountOut) {
        amountOut = vault.executeAction(policyId, router, amountIn, quotedSlippageBps, projectedReserve, data);
        emit AgentExecutionSubmitted(policyId, msg.sender, true, "Rail: executed");
    }

    function recordBlocked(uint256 policyId, string calldata reason) external onlyAgent {
        vault.recordBlockedAction(policyId, reason);
        emit AgentExecutionSubmitted(policyId, msg.sender, false, reason);
    }
}
