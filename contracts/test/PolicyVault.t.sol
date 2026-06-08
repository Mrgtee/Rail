// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyVault} from "../src/PolicyVault.sol";
import {AgentExecutor} from "../src/AgentExecutor.sol";
import {MockRouter} from "../src/MockRouter.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract PolicyVaultTest is Test {
    PolicyVault internal vault;
    AgentExecutor internal executor;
    MockRouter internal router;
    MockUSDC internal usdc;
    MockUSDC internal weth;

    address internal user = address(0xA11CE);
    address internal agent = address(0xA6E17);
    uint256 internal policyId;

    function setUp() public {
        usdc = new MockUSDC("Mock USDC", "USDC", 6);
        weth = new MockUSDC("Mock WETH", "WETH", 18);
        router = new MockRouter();
        vault = new PolicyVault(address(0));
        executor = new AgentExecutor(vault, agent);
        vault.setExecutor(address(executor), true);
        usdc.setMinter(address(router), true);
        weth.setMinter(address(router), true);
        router.setPrice(address(usdc), 100_000_000);
        router.setPrice(address(weth), 2_500 * 100_000_000);

        usdc.mint(user, 1_000e6);
        vm.startPrank(user);
        usdc.approve(address(vault), 500e6);
        vault.deposit(address(usdc), 500e6);
        policyId = vault.createPolicy(_defaultPolicy());
        vm.stopPrank();
    }

    function testCreatesPolicyAndTracksDeposit() public view {
        assertEq(vault.vaultBalanceOf(user, address(usdc)), 500e6);
        (address owner,,,,,,,,,,,,,) = vault.policies(policyId);
        assertEq(owner, user);
    }

    function testExecutesValidDcaAction() public {
        vm.prank(agent);
        uint256 amountOut = executor.execute(policyId, address(router), 20e6, 100, 480e6, "");

        assertEq(amountOut, 8e15);
        assertEq(vault.vaultBalanceOf(user, address(usdc)), 480e6);
        assertEq(vault.vaultBalanceOf(user, address(weth)), 8e15);
    }

    function testBlocksOverspend() public {
        vm.prank(agent);
        vm.expectRevert(bytes("Rail: spend limit exceeded"));
        executor.execute(policyId, address(router), 25e6, 100, 475e6, "");
    }

    function testBlocksSlippageAbovePolicy() public {
        vm.prank(agent);
        vm.expectRevert(bytes("Rail: slippage exceeded"));
        executor.execute(policyId, address(router), 20e6, 150, 480e6, "");
    }

    function testBlocksReserveViolation() public {
        PolicyVault.PolicyConfig memory config = _defaultPolicy();
        config.minimumReserve = 50e6;

        vm.prank(user);
        uint256 reservePolicyId = vault.createPolicy(config);

        vm.prank(agent);
        vm.expectRevert(bytes("Rail: reserve violated"));
        executor.execute(reservePolicyId, address(router), 20e6, 100, 40e6, "");
    }

    function testBlocksExpiredPolicy() public {
        vm.warp(block.timestamp + 91 days);
        vm.prank(agent);
        vm.expectRevert(bytes("Rail: policy expired"));
        executor.execute(policyId, address(router), 20e6, 100, 480e6, "");
    }

    function testPauseResumeAndRevoke() public {
        vm.prank(user);
        vault.pausePolicy(policyId);

        vm.prank(agent);
        vm.expectRevert(bytes("Rail: policy inactive"));
        executor.execute(policyId, address(router), 20e6, 100, 480e6, "");

        vm.prank(user);
        vault.resumePolicy(policyId);

        vm.prank(user);
        vault.revokePolicy(policyId);

        vm.prank(agent);
        vm.expectRevert(bytes("Rail: policy inactive"));
        executor.execute(policyId, address(router), 20e6, 100, 480e6, "");
    }

    function testBlocksUnauthorizedAgent() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("Rail: agent not authorized"));
        executor.execute(policyId, address(router), 20e6, 100, 480e6, "");
    }

    function _defaultPolicy() internal view returns (PolicyVault.PolicyConfig memory) {
        return PolicyVault.PolicyConfig({
            inputAsset: address(usdc),
            outputAsset: address(weth),
            spendLimit: 20e6,
            monthlyCap: 100e6,
            slippageBps: 100,
            minimumReserve: 0,
            cooldownSeconds: 1 days,
            expiresAt: uint64(block.timestamp + 90 days),
            agent: agent
        });
    }
}
