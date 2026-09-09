// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IntentManagerCallable} from "../contracts/interactions/IntentManagerCallable.sol";
import {RewardMinter} from "../contracts/interactions/RewardMinter.sol";
import {IPostInteractionHook} from "../contracts/interactions/interfaces/IPostInteractionHook.sol";
import {IPreSwapResult} from "../contracts/interactions/interfaces/IPreSwapResult.sol";

contract RewardMinterTest is Test {
    RewardMinter internal minter;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant INTENT_MANAGER = 0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708;
    bytes32 internal constant INTENT_ID = bytes32(uint256(1));
    bytes32 internal constant TRADE_ID = bytes32(uint256(2));

    function setUp() public {
        minter = new RewardMinter();
    }

    function test_DecodePayload() public view {
        (address subject, uint256 reward) = minter.decodePayload(abi.encode(ALICE, 50));
        assertEq(subject, ALICE);
        assertEq(reward, 50);
    }

    function test_OnPreCall_AccruesReward() public {
        vm.startPrank(INTENT_MANAGER);
        minter.onPreCall(INTENT_ID, TRADE_ID, abi.encode(ALICE, 10));
        assertEq(minter.rewards(ALICE), 10);
        minter.onPreCall(INTENT_ID, TRADE_ID, abi.encode(ALICE, 5));
        vm.stopPrank();
        assertEq(minter.rewards(ALICE), 15);
    }

    function test_OnPreCall_RevertsWhenNotIntentManager() public {
        vm.expectRevert(IntentManagerCallable.OnlyIntentManager.selector);
        minter.onPreCall(INTENT_ID, TRADE_ID, abi.encode(ALICE, 10));
    }

    function test_OnPostCallVariants_AllAccrue() public {
        IPostInteractionHook.SameChainWithPreSwapChainContext memory same = IPostInteractionHook
            .SameChainWithPreSwapChainContext({
                intentId: INTENT_ID,
                tradeId: TRADE_ID,
                payload: abi.encode(BOB, 7),
                preSwapResults: new IPreSwapResult.PreSwapResult[](0),
                takeToken: address(0xDA1),
                takeAmountAfterFeeCharge: 1,
                receiver: BOB
            });
        vm.prank(INTENT_MANAGER);
        minter.onPostCallForSameChainIntentWithPreSwap(same);
        assertEq(minter.rewards(BOB), 7);

        IPostInteractionHook.CrossChainContext memory xc = IPostInteractionHook.CrossChainContext({
            intentId: INTENT_ID,
            tradeId: TRADE_ID,
            payload: abi.encode(BOB, 3),
            giveToken: address(0xC0FFEE),
            giveAmount: 1,
            takeToken: abi.encodePacked(address(0xDA1)),
            takeAmount: 1,
            takeChainId: uint32(8453),
            takeChainReceiver: abi.encodePacked(BOB)
        });
        vm.prank(INTENT_MANAGER);
        minter.onPostCallForCrossChainIntent(xc);
        assertEq(minter.rewards(BOB), 10);
    }

    function test_PerSubjectAccounting() public {
        vm.startPrank(INTENT_MANAGER);
        minter.onPreCall(INTENT_ID, TRADE_ID, abi.encode(ALICE, 11));
        minter.onPreCall(INTENT_ID, TRADE_ID, abi.encode(BOB, 22));
        vm.stopPrank();
        assertEq(minter.rewards(ALICE), 11);
        assertEq(minter.rewards(BOB), 22);
    }
}
