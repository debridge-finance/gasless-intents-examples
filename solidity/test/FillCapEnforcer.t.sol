// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {FillCapEnforcer} from "../contracts/interactions/FillCapEnforcer.sol";
import {IntentManagerCallable} from "../contracts/interactions/IntentManagerCallable.sol";

contract FillCapEnforcerTest is Test {
    FillCapEnforcer internal cap;

    address internal owner = address(this);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal constant INTENT_MANAGER = 0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708;

    bytes32 internal constant INTENT_ID = bytes32(uint256(1));
    bytes32 internal constant TRADE_ID = bytes32(uint256(2));

    function setUp() public {
        cap = new FillCapEnforcer();
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(cap.owner(), owner);
    }

    function test_NoCap_NeverReverts() public {
        bytes memory payload = abi.encode(alice);
        vm.startPrank(INTENT_MANAGER);
        for (uint256 i; i < 5; ++i) {
            cap.onPreCall(INTENT_ID, TRADE_ID, payload);
        }
        vm.stopPrank();
        assertEq(cap.fills(INTENT_ID), 5);
    }

    function test_OnPreCall_RevertsWhenNotIntentManager() public {
        vm.expectRevert(IntentManagerCallable.OnlyIntentManager.selector);
        cap.onPreCall(INTENT_ID, TRADE_ID, abi.encode(alice));
    }

    function test_Cap2_ThirdCallReverts() public {
        cap.setCap(alice, 2);
        bytes memory payload = abi.encode(alice);
        vm.startPrank(INTENT_MANAGER);
        cap.onPreCall(INTENT_ID, TRADE_ID, payload);
        cap.onPreCall(INTENT_ID, TRADE_ID, payload);
        vm.expectRevert(
            abi.encodeWithSelector(FillCapEnforcer.HardCapExceeded.selector, alice, uint256(2), uint256(3))
        );
        cap.onPreCall(INTENT_ID, TRADE_ID, payload);
        vm.stopPrank();
    }

    function test_SetCap_OwnerOnly() public {
        vm.prank(alice);
        vm.expectRevert(FillCapEnforcer.NotOwner.selector);
        cap.setCap(alice, 1);
    }

    function test_SetManyCaps_FlipsBatch() public {
        address[] memory batch = new address[](2);
        batch[0] = alice;
        batch[1] = bob;
        cap.setManyCaps(batch, 3);
        assertEq(cap.caps(alice), 3);
        assertEq(cap.caps(bob), 3);
    }

    function test_TransferOwnership() public {
        vm.expectRevert(FillCapEnforcer.ZeroAddress.selector);
        cap.transferOwnership(address(0));
        cap.transferOwnership(bob);
        assertEq(cap.owner(), bob);
        vm.expectRevert(FillCapEnforcer.NotOwner.selector);
        cap.setCap(alice, 1);
        vm.prank(bob);
        cap.setCap(alice, 1);
        assertEq(cap.caps(alice), 1);
    }
}
