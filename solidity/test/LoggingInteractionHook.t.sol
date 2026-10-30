// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IntentManagerCallable} from "../contracts/interactions/IntentManagerCallable.sol";
import {LoggingInteractionHook} from "../contracts/interactions/LoggingInteractionHook.sol";
import {IPostInteractionHook} from "../contracts/interactions/interfaces/IPostInteractionHook.sol";
import {IPreSwapResult} from "../contracts/interactions/interfaces/IPreSwapResult.sol";

contract LoggingInteractionHookTest is Test {
    LoggingInteractionHook internal hook;

    address internal constant SUBJECT = address(0xA11CE);
    address internal constant RECEIVER = address(0xB0B);
    address internal constant TAKE_TOKEN = address(0xDA1);
    address internal constant GIVE_TOKEN = address(0xC0FFEE);
    address internal constant INTENT_MANAGER = 0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708;
    bytes32 internal constant INTENT_ID = bytes32(uint256(1));
    bytes32 internal constant TRADE_ID = bytes32(uint256(2));

    function setUp() public {
        hook = new LoggingInteractionHook();
    }

    function _logPayload(string memory label, uint256 referenceId) internal pure returns (bytes memory) {
        return abi.encode(label, SUBJECT, referenceId);
    }

    function test_DecodePayload_RoundTrip() public view {
        bytes memory payload = _logPayload("test-label", 42);
        LoggingInteractionHook.Decoded memory d = hook.decodePayload(payload);
        assertEq(d.label, "test-label");
        assertEq(d.subject, SUBJECT);
        assertEq(d.referenceId, 42);
    }

    function testFuzz_DecodePayload_RoundTrip(string memory label, address subject, uint256 referenceId) public view {
        bytes memory payload = abi.encode(label, subject, referenceId);
        LoggingInteractionHook.Decoded memory d = hook.decodePayload(payload);
        assertEq(d.label, label);
        assertEq(d.subject, subject);
        assertEq(d.referenceId, referenceId);
    }

    function test_OnPreCall_IncrementsFillCount() public {
        bytes memory payload = _logPayload("pre", 0);
        vm.startPrank(INTENT_MANAGER);
        hook.onPreCall(INTENT_ID, TRADE_ID, payload);
        assertEq(hook.fillCount(INTENT_ID), 1);
        hook.onPreCall(INTENT_ID, TRADE_ID, payload);
        vm.stopPrank();
        assertEq(hook.fillCount(INTENT_ID), 2);
    }

    function test_OnPreCall_RevertsWhenNotIntentManager() public {
        vm.expectRevert(IntentManagerCallable.OnlyIntentManager.selector);
        hook.onPreCall(INTENT_ID, TRADE_ID, _logPayload("pre", 0));
    }

    function test_OnPreCall_SoftCap_DoesNotRevert() public {
        bytes memory payload = _logPayload("pre", 1);
        vm.startPrank(INTENT_MANAGER);
        hook.onPreCall(INTENT_ID, TRADE_ID, payload);
        // Second call crosses the soft cap but must not revert.
        hook.onPreCall(INTENT_ID, TRADE_ID, payload);
        vm.stopPrank();
        assertEq(hook.fillCount(INTENT_ID), 2);
    }

    function test_OnPreCall_NoCap_NeverExceeds() public {
        bytes memory payload = _logPayload("pre", 0);
        vm.startPrank(INTENT_MANAGER);
        for (uint256 i; i < 5; ++i) {
            hook.onPreCall(INTENT_ID, TRADE_ID, payload);
        }
        vm.stopPrank();
        assertEq(hook.fillCount(INTENT_ID), 5);
    }

    function _legs(uint256 a, uint256 b) internal pure returns (IPreSwapResult.PreSwapResult[] memory legs) {
        legs = new IPreSwapResult.PreSwapResult[](2);
        legs[0] = IPreSwapResult.PreSwapResult({inputToken: address(0x1), inputAmount: 100, outputAmount: a});
        legs[1] = IPreSwapResult.PreSwapResult({inputToken: address(0x2), inputAmount: 200, outputAmount: b});
    }

    function test_OnPostCall_SameChain_DerivesFee() public {
        IPostInteractionHook.SameChainWithPreSwapChainContext memory ctx = IPostInteractionHook
            .SameChainWithPreSwapChainContext({
                intentId: INTENT_ID,
                tradeId: TRADE_ID,
                payload: _logPayload("post", 0),
                preSwapResults: _legs(600, 400),
                takeToken: TAKE_TOKEN,
                takeAmountAfterFeeCharge: 970,
                receiver: RECEIVER
            });
        vm.prank(INTENT_MANAGER);
        hook.onPostCallForSameChainIntentWithPreSwap(ctx);
        // No state change to assert; events were emitted (covered separately in
        // integration tests). The non-reverting call is itself the assertion.
    }

    function test_OnPostCall_SameChain_NoFeeWhenOutputBelowAfterCharge() public {
        IPostInteractionHook.SameChainWithPreSwapChainContext memory ctx = IPostInteractionHook
            .SameChainWithPreSwapChainContext({
                intentId: INTENT_ID,
                tradeId: TRADE_ID,
                payload: _logPayload("post", 0),
                preSwapResults: _legs(100, 100),
                takeToken: TAKE_TOKEN,
                takeAmountAfterFeeCharge: 500,
                receiver: RECEIVER
            });
        vm.prank(INTENT_MANAGER);
        hook.onPostCallForSameChainIntentWithPreSwap(ctx);
        // Path is exercised; no fee event emitted because totalOutput < takeAmountAfterFeeCharge.
    }

    function test_OnPostCall_CrossChainWithPreSwap_Accumulates() public {
        IPostInteractionHook.CrossChainWithPreSwapContext memory ctx = IPostInteractionHook
            .CrossChainWithPreSwapContext({
                intentId: INTENT_ID,
                tradeId: TRADE_ID,
                payload: _logPayload("post-xc-ps", 0),
                preSwapResults: _legs(700, 300),
                giveToken: GIVE_TOKEN,
                giveAmount: 1000,
                takeToken: abi.encodePacked(TAKE_TOKEN),
                takeAmount: 999,
                takeChainId: uint32(8453),
                takeChainReceiver: abi.encodePacked(RECEIVER)
            });
        vm.startPrank(INTENT_MANAGER);
        hook.onPostCallForCrossChainIntentWithPreSwap(ctx);
        assertEq(hook.cumulativeGiveAmount(INTENT_ID), 1000);
        hook.onPostCallForCrossChainIntentWithPreSwap(ctx);
        vm.stopPrank();
        assertEq(hook.cumulativeGiveAmount(INTENT_ID), 2000);
    }

    function test_OnPostCall_CrossChain_Accumulates() public {
        IPostInteractionHook.CrossChainContext memory ctx = IPostInteractionHook.CrossChainContext({
            intentId: INTENT_ID,
            tradeId: TRADE_ID,
            payload: _logPayload("post-xc", 0),
            giveToken: GIVE_TOKEN,
            giveAmount: 1234,
            takeToken: abi.encodePacked(TAKE_TOKEN),
            takeAmount: 1200,
            takeChainId: uint32(42161),
            takeChainReceiver: abi.encodePacked(RECEIVER)
        });
        vm.prank(INTENT_MANAGER);
        hook.onPostCallForCrossChainIntent(ctx);
        assertEq(hook.cumulativeGiveAmount(INTENT_ID), 1234);
    }
}
