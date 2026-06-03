// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {FillCounter} from "../contracts/interactions/FillCounter.sol";
import {IntentManagerCallable} from "../contracts/interactions/IntentManagerCallable.sol";
import {IPostInteractionHook} from "../contracts/interactions/interfaces/IPostInteractionHook.sol";
import {IPreSwapResult} from "../contracts/interactions/interfaces/IPreSwapResult.sol";

contract FillCounterTest is Test {
    FillCounter internal counter;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant TAKE_TOKEN = address(0xDA1);
    address internal constant GIVE_TOKEN = address(0xC0FFEE);
    address internal constant INTENT_MANAGER = 0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708;
    bytes32 internal constant INTENT_A = bytes32(uint256(1));
    bytes32 internal constant INTENT_B = bytes32(uint256(2));
    bytes32 internal constant TRADE_ID = bytes32(uint256(99));

    function setUp() public {
        counter = new FillCounter();
    }

    function test_OnPreCall_IncrementsBothCounters() public {
        vm.startPrank(INTENT_MANAGER);
        counter.onPreCall(INTENT_A, TRADE_ID, abi.encode(ALICE));
        assertEq(counter.intentFillCount(INTENT_A), 1);
        assertEq(counter.lifetimeFills(ALICE), 1);

        counter.onPreCall(INTENT_A, TRADE_ID, abi.encode(BOB));
        assertEq(counter.intentFillCount(INTENT_A), 2);
        assertEq(counter.lifetimeFills(BOB), 1);

        counter.onPreCall(INTENT_B, TRADE_ID, abi.encode(ALICE));
        vm.stopPrank();
        assertEq(counter.intentFillCount(INTENT_B), 1);
        assertEq(counter.lifetimeFills(ALICE), 2);
    }

    function test_OnPreCall_RevertsWhenNotIntentManager() public {
        vm.expectRevert(IntentManagerCallable.OnlyIntentManager.selector);
        counter.onPreCall(INTENT_A, TRADE_ID, abi.encode(ALICE));
    }

    function _legs() internal pure returns (IPreSwapResult.PreSwapResult[] memory legs) {
        legs = new IPreSwapResult.PreSwapResult[](0);
    }

    function _sameChain(address taker, uint256 net) internal pure returns (IPostInteractionHook.SameChainWithPreSwapChainContext memory ctx) {
        ctx = IPostInteractionHook.SameChainWithPreSwapChainContext({
            intentId: INTENT_A,
            tradeId: TRADE_ID,
            payload: abi.encode(taker),
            preSwapResults: _legs(),
            takeToken: TAKE_TOKEN,
            takeAmountAfterFeeCharge: net,
            receiver: taker
        });
    }

    function test_SameChainPost_AddsTakeAmountAfterFeeCharge() public {
        vm.startPrank(INTENT_MANAGER);
        counter.onPostCallForSameChainIntentWithPreSwap(_sameChain(ALICE, 750));
        assertEq(counter.lifetimeGiveAmount(ALICE), 750);
        assertEq(counter.lifetimeGiveAmountByToken(ALICE, TAKE_TOKEN), 750);

        counter.onPostCallForSameChainIntentWithPreSwap(_sameChain(ALICE, 250));
        vm.stopPrank();
        assertEq(counter.lifetimeGiveAmount(ALICE), 1000);
        assertEq(counter.lifetimeGiveAmountByToken(ALICE, TAKE_TOKEN), 1000);
    }

    function _crossChainPreSwap(address taker, uint256 give) internal pure returns (IPostInteractionHook.CrossChainWithPreSwapContext memory ctx) {
        ctx = IPostInteractionHook.CrossChainWithPreSwapContext({
            intentId: INTENT_A,
            tradeId: TRADE_ID,
            payload: abi.encode(taker),
            preSwapResults: _legs(),
            giveToken: GIVE_TOKEN,
            giveAmount: give,
            takeToken: abi.encodePacked(TAKE_TOKEN),
            takeAmount: give,
            takeChainId: uint32(8453),
            takeChainReceiver: abi.encodePacked(taker)
        });
    }

    function test_CrossChainPreSwapPost_AddsGiveAmount() public {
        vm.prank(INTENT_MANAGER);
        counter.onPostCallForCrossChainIntentWithPreSwap(_crossChainPreSwap(ALICE, 1000));
        assertEq(counter.lifetimeGiveAmount(ALICE), 1000);
        assertEq(counter.lifetimeGiveAmountByToken(ALICE, GIVE_TOKEN), 1000);
    }

    function _crossChain(address taker, uint256 give) internal pure returns (IPostInteractionHook.CrossChainContext memory ctx) {
        ctx = IPostInteractionHook.CrossChainContext({
            intentId: INTENT_A,
            tradeId: TRADE_ID,
            payload: abi.encode(taker),
            giveToken: GIVE_TOKEN,
            giveAmount: give,
            takeToken: abi.encodePacked(TAKE_TOKEN),
            takeAmount: give,
            takeChainId: uint32(42161),
            takeChainReceiver: abi.encodePacked(taker)
        });
    }

    function test_CrossChainPost_AddsGiveAmount() public {
        vm.prank(INTENT_MANAGER);
        counter.onPostCallForCrossChainIntent(_crossChain(BOB, 333));
        assertEq(counter.lifetimeGiveAmount(BOB), 333);
        assertEq(counter.lifetimeGiveAmountByToken(BOB, GIVE_TOKEN), 333);
    }

    function test_GetStats_ReturnsTuple() public {
        vm.prank(INTENT_MANAGER);
        counter.onPreCall(INTENT_A, TRADE_ID, abi.encode(ALICE));
        vm.prank(INTENT_MANAGER);
        counter.onPostCallForCrossChainIntent(_crossChain(ALICE, 500));
        (uint256 fills, uint256 giveTotal) = counter.getStats(ALICE);
        assertEq(fills, 1);
        assertEq(giveTotal, 500);
    }
}
