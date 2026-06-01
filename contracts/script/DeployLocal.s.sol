// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentExecutor} from "../src/AgentExecutor.sol";
import {MockRouter} from "../src/MockRouter.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PolicyVault} from "../src/PolicyVault.sol";
import {StrategyRegistry} from "../src/StrategyRegistry.sol";

contract DeployLocal is Script {
    function run() external returns (PolicyVault vault, AgentExecutor executor, StrategyRegistry registry, MockUSDC usdc, MockUSDC weth, MockRouter router) {
        address agent = vm.envOr("AGENT_ADDRESS", msg.sender);

        vm.startBroadcast();
        usdc = new MockUSDC("Rail Demo USDC", "rUSDC", 6);
        weth = new MockUSDC("Rail Demo WETH", "rWETH", 18);
        router = new MockRouter();
        registry = new StrategyRegistry();
        vault = new PolicyVault(address(0));
        executor = new AgentExecutor(vault, agent);
        vault.setExecutor(address(executor), true);
        router.setRate(address(usdc), address(weth), 10_000);
        registry.setStrategy(keccak256("DCA"), "DCA", "ipfs://rail-demo-dca", true);
        vm.stopBroadcast();

        console2.log("PolicyVault", address(vault));
        console2.log("AgentExecutor", address(executor));
        console2.log("StrategyRegistry", address(registry));
        console2.log("MockUSDC", address(usdc));
        console2.log("MockWETH", address(weth));
        console2.log("MockRouter", address(router));
    }
}
