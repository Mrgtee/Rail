// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStrategyRouter {
    function execute(address owner, address inputAsset, address outputAsset, uint256 amountIn, bytes calldata data) external returns (uint256 amountOut);
}

contract PolicyVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum PolicyStatus {
        None,
        Active,
        Paused,
        Revoked,
        Expired
    }

    struct PolicyConfig {
        address inputAsset;
        address outputAsset;
        uint256 spendLimit;
        uint256 monthlyCap;
        uint16 slippageBps;
        uint256 minimumReserve;
        uint32 cooldownSeconds;
        uint64 expiresAt;
        address agent;
    }

    struct Policy {
        address owner;
        address inputAsset;
        address outputAsset;
        uint256 spendLimit;
        uint256 monthlyCap;
        uint256 spentThisPeriod;
        uint256 minimumReserve;
        uint16 slippageBps;
        uint32 cooldownSeconds;
        uint64 lastExecutedAt;
        uint64 periodStartedAt;
        uint64 expiresAt;
        address agent;
        PolicyStatus status;
    }

    uint256 public nextPolicyId = 1;
    mapping(uint256 => Policy) public policies;
    mapping(address => mapping(address => uint256)) public vaultBalanceOf;
    mapping(address => bool) public authorizedExecutors;

    event ExecutorSet(address indexed executor, bool allowed);
    event PolicyCreated(uint256 indexed policyId, address indexed owner, address indexed agent, address inputAsset, address outputAsset);
    event PolicyPaused(uint256 indexed policyId);
    event PolicyResumed(uint256 indexed policyId);
    event PolicyRevoked(uint256 indexed policyId);
    event Deposited(address indexed owner, address indexed asset, uint256 amount);
    event Withdrawn(address indexed owner, address indexed asset, uint256 amount);
    event ActionExecuted(uint256 indexed policyId, address indexed executor, uint256 amountIn, uint256 amountOut);
    event ActionBlocked(uint256 indexed policyId, address indexed executor, string reason);

    modifier onlyPolicyOwner(uint256 policyId) {
        require(policies[policyId].owner == msg.sender, "Rail: not policy owner");
        _;
    }

    modifier onlyExecutor() {
        require(authorizedExecutors[msg.sender], "Rail: executor not authorized");
        _;
    }

    constructor(address initialExecutor) Ownable(msg.sender) {
        if (initialExecutor != address(0)) {
            authorizedExecutors[initialExecutor] = true;
            emit ExecutorSet(initialExecutor, true);
        }
    }

    function setExecutor(address executor, bool allowed) external onlyOwner {
        authorizedExecutors[executor] = allowed;
        emit ExecutorSet(executor, allowed);
    }

    function deposit(address asset, uint256 amount) external nonReentrant {
        require(asset != address(0), "Rail: asset required");
        require(amount > 0, "Rail: amount required");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        vaultBalanceOf[msg.sender][asset] += amount;

        emit Deposited(msg.sender, asset, amount);
    }

    function withdraw(address asset, uint256 amount) external nonReentrant {
        require(amount > 0, "Rail: amount required");
        require(vaultBalanceOf[msg.sender][asset] >= amount, "Rail: insufficient vault balance");

        vaultBalanceOf[msg.sender][asset] -= amount;
        IERC20(asset).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, asset, amount);
    }

    function createPolicy(PolicyConfig calldata config) external returns (uint256 policyId) {
        require(config.inputAsset != address(0) && config.outputAsset != address(0), "Rail: assets required");
        require(config.spendLimit > 0, "Rail: spend required");
        require(config.monthlyCap >= config.spendLimit, "Rail: cap below spend");
        require(config.slippageBps <= 10_000, "Rail: slippage too high");
        require(config.cooldownSeconds > 0, "Rail: cooldown required");
        require(config.expiresAt > block.timestamp, "Rail: expiry required");
        require(config.agent != address(0), "Rail: agent required");

        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            owner: msg.sender,
            inputAsset: config.inputAsset,
            outputAsset: config.outputAsset,
            spendLimit: config.spendLimit,
            monthlyCap: config.monthlyCap,
            spentThisPeriod: 0,
            minimumReserve: config.minimumReserve,
            slippageBps: config.slippageBps,
            cooldownSeconds: config.cooldownSeconds,
            lastExecutedAt: 0,
            periodStartedAt: uint64(block.timestamp),
            expiresAt: config.expiresAt,
            agent: config.agent,
            status: PolicyStatus.Active
        });

        emit PolicyCreated(policyId, msg.sender, config.agent, config.inputAsset, config.outputAsset);
    }

    function pausePolicy(uint256 policyId) external onlyPolicyOwner(policyId) {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Active, "Rail: not active");
        policy.status = PolicyStatus.Paused;
        emit PolicyPaused(policyId);
    }

    function resumePolicy(uint256 policyId) external onlyPolicyOwner(policyId) {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Paused, "Rail: not paused");
        policy.status = PolicyStatus.Active;
        emit PolicyResumed(policyId);
    }

    function revokePolicy(uint256 policyId) external onlyPolicyOwner(policyId) {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Active || policy.status == PolicyStatus.Paused, "Rail: cannot revoke");
        policy.status = PolicyStatus.Revoked;
        emit PolicyRevoked(policyId);
    }

    function executeAction(
        uint256 policyId,
        address router,
        uint256 amountIn,
        uint16 quotedSlippageBps,
        uint256 projectedReserve,
        bytes calldata data
    ) external onlyExecutor nonReentrant returns (uint256 amountOut) {
        (bool allowed, string memory reason) = canExecute(policyId, amountIn, quotedSlippageBps, projectedReserve);
        require(allowed, reason);
        require(router != address(0), "Rail: router required");

        Policy storage policy = policies[policyId];
        _rollPeriodIfNeeded(policy);

        policy.spentThisPeriod += amountIn;
        policy.lastExecutedAt = uint64(block.timestamp);
        vaultBalanceOf[policy.owner][policy.inputAsset] -= amountIn;

        IERC20(policy.inputAsset).safeIncreaseAllowance(router, amountIn);
        amountOut = IStrategyRouter(router).execute(policy.owner, policy.inputAsset, policy.outputAsset, amountIn, data);
        vaultBalanceOf[policy.owner][policy.outputAsset] += amountOut;

        emit ActionExecuted(policyId, msg.sender, amountIn, amountOut);
    }

    function recordBlockedAction(uint256 policyId, string calldata reason) external onlyExecutor {
        emit ActionBlocked(policyId, msg.sender, reason);
    }

    function canExecute(
        uint256 policyId,
        uint256 amountIn,
        uint16 quotedSlippageBps,
        uint256 projectedReserve
    ) public view returns (bool, string memory) {
        Policy memory policy = policies[policyId];

        if (policy.owner == address(0)) return (false, "Rail: policy missing");
        if (policy.status != PolicyStatus.Active) return (false, "Rail: policy inactive");
        if (block.timestamp >= policy.expiresAt) return (false, "Rail: policy expired");
        if (policy.lastExecutedAt != 0 && block.timestamp < policy.lastExecutedAt + policy.cooldownSeconds) return (false, "Rail: cooldown active");
        if (amountIn == 0 || amountIn > policy.spendLimit) return (false, "Rail: spend limit exceeded");
        if (quotedSlippageBps > policy.slippageBps) return (false, "Rail: slippage exceeded");
        if (projectedReserve < policy.minimumReserve) return (false, "Rail: reserve violated");
        if (vaultBalanceOf[policy.owner][policy.inputAsset] < amountIn) return (false, "Rail: insufficient vault balance");

        uint256 periodSpend = policy.spentThisPeriod;
        if (block.timestamp >= policy.periodStartedAt + 30 days) {
            periodSpend = 0;
        }
        if (periodSpend + amountIn > policy.monthlyCap) return (false, "Rail: monthly cap exceeded");

        return (true, "Rail: allowed");
    }

    function _rollPeriodIfNeeded(Policy storage policy) private {
        if (block.timestamp >= policy.periodStartedAt + 30 days) {
            policy.periodStartedAt = uint64(block.timestamp);
            policy.spentThisPeriod = 0;
        }
    }
}
