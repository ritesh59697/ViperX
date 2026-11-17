// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { Registry } from "../src/registry/Registry.sol";

contract RegistryTest is Test {
    Registry internal registry;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal vault = makeAddr("vault");

    event AgentRegistered(
        address indexed owner, string agentId, string name, string strategyUri, address indexed vaultAddress
    );

    function setUp() public {
        registry = new Registry();
    }

    function test_registerStoresAgentAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(alice, "momentum_1", "Momentum", "ipfs://x", vault);
        vm.prank(alice);
        registry.registerAgent("momentum_1", "Momentum", "ipfs://x", vault);

        Registry.Agent memory a = registry.getAgent("momentum_1");
        assertEq(a.owner, alice);
        assertEq(a.name, "Momentum");
        assertEq(a.vaultAddress, vault);
        assertEq(a.status, "Active");
        assertEq(registry.getOwnerAgents(alice).length, 1);
        assertEq(registry.getAllAgentIds().length, 1);
    }

    function test_duplicateIdReverts() public {
        vm.prank(alice);
        registry.registerAgent("id", "A", "", vault);
        vm.prank(bob);
        vm.expectRevert("Registry: agent ID already registered");
        registry.registerAgent("id", "B", "", vault);
    }

    function test_rejectsEmptyFieldsAndZeroVault() public {
        vm.expectRevert("Registry: agent ID cannot be empty");
        registry.registerAgent("", "A", "", vault);
        vm.expectRevert("Registry: name cannot be empty");
        registry.registerAgent("id", "", "", vault);
        vm.expectRevert("Registry: invalid vault address");
        registry.registerAgent("id", "A", "", address(0));
    }

    function test_onlyOwnerChangesStatusAndMetadata() public {
        vm.prank(alice);
        registry.registerAgent("id", "A", "", vault);

        vm.prank(bob);
        vm.expectRevert("Registry: caller is not the agent owner");
        registry.changeStatus("id", "Paused");

        vm.prank(alice);
        registry.changeStatus("id", "Paused");
        assertEq(registry.getAgent("id").status, "Paused");

        vm.prank(alice);
        vm.expectRevert("Registry: invalid status value");
        registry.changeStatus("id", "Deleted");

        vm.prank(alice);
        registry.updateMetadata("id", "A2", "ipfs://y");
        assertEq(registry.getAgent("id").name, "A2");
    }
}
