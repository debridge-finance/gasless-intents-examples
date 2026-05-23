// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProtocolFeeRecorder} from "../contracts/interactions/ProtocolFeeRecorder.sol";
import {IPostInteractionHook} from "../contracts/interactions/interfaces/IPostInteractionHook.sol";
import {IPreSwapResult} from "../contracts/interactions/interfaces/IPreSwapResult.sol";

contract ProtocolFeeRecorderTest is Test {
    ProtocolFeeRecorder internal recorder;

    address internal constant SUBJECT = address(0xA11CE);
    address internal constant TAKE_TOKEN = address(0xDA1);
    address internal constant GIVE_TOKEN = address(0xC0FFEE);
    bytes32 internal constant INTENT_ID = bytes32(uint256(1));
    bytes32 internal constant TRADE_ID = bytes32(uint256(2));

    function setUp() public {
        recorder = new ProtocolFeeRecorder();
    }

    function _legs(uint256 a, uint256 b) internal pure returns (IPreSwapResult.PreSwapResult[] memory legs) {
        legs = new IPreSwapResult.PreSwapResult[](2);
        legs[0] = IPreSwapResult.PreSwapResult({inputToken: address(0x1), inputAmount: 100, outputAmount: a});
        legs[1] = IPreSwapResult.PreSwapResult({inputToken: address(0x2), inputAmount: 200, outputAmount: b});
    }

    function _ctx(uint256 leg1, uint256 leg2, uint256 takeAfterFee) internal view returns (IPostInteractionHook.SameChainWithPreSwapChainContext memory ctx) {
        ctx = IPostInteractionHook.SameChainWithPreSwapChainContext({
            intentId: INTENT_ID,
            tradeId: TRADE_ID,
            payload: abi.encode(SUBJECT),
            preSwapResults: _legs(leg1, leg2),
            takeToken: TAKE_TOKEN,
            takeAmountAfterFeeCharge: takeAfterFee,
            receiver: SUBJECT
        });
    }

    function test_OnPreCall_NoOp() public {
        recorder.onPreCall(INTENT_ID, TRADE_ID, abi.encode(SUBJECT));
        // Confirms it doesn't revert; no observable state.
    }

    function test_SameChain_Fee30() public {
        // total = 1000, takeAfter = 970, fee = 30, bps = 300
        recorder.onPostCallForSameChainIntentWithPreSwap(_ctx(600, 400, 970));
        assertEq(recorder.intentTokenFee(INTENT_ID, TAKE_TOKEN), 30);
        assertEq(recorder.tokenTotalFee(TAKE_TOKEN), 30);
    }

    function test_SameChain_FeeZeroWhenEqual() public {
        recorder.onPostCallForSameChainIntentWithPreSwap(_ctx(500, 500, 1000));
        assertEq(recorder.intentTokenFee(INTENT_ID, TAKE_TOKEN), 0);
        assertEq(recorder.tokenTotalFee(TAKE_TOKEN), 0);
    }

    function test_SameChain_FeeSaturatesWhenOutputBelow() public {
        // total = 100, takeAfter = 500 → fee = 0 (saturating)
        recorder.onPostCallForSameChainIntentWithPreSwap(_ctx(50, 50, 500));
        assertEq(recorder.intentTokenFee(INTENT_ID, TAKE_TOKEN), 0);
    }

    function test_SameChain_EmptyLegs() public {
        IPostInteractionHook.SameChainWithPreSwapChainContext memory ctx = IPostInteractionHook
            .SameChainWithPreSwapChainContext({
                intentId: INTENT_ID,
                tradeId: TRADE_ID,
                payload: abi.encode(SUBJECT),
                preSwapResults: new IPreSwapResult.PreSwapResult[](0),
                takeToken: TAKE_TOKEN,
                takeAmountAfterFeeCharge: 0,
                receiver: SUBJECT
            });
        recorder.onPostCallForSameChainIntentWithPreSwap(ctx);
        assertEq(recorder.intentTokenFee(INTENT_ID, TAKE_TOKEN), 0);
    }

    function test_CrossChainPreSwap_Reverts() public {
        IPostInteractionHook.CrossChainWithPreSwapContext memory ctx = IPostInteractionHook
            .CrossChainWithPreSwapContext({
                intentId: INTENT_ID,
                tradeId: TRADE_ID,
                payload: abi.encode(SUBJECT),
                preSwapResults: new IPreSwapResult.PreSwapResult[](0),
                giveToken: GIVE_TOKEN,
                giveAmount: 1,
                takeToken: abi.encodePacked(TAKE_TOKEN),
                takeAmount: 1,
                takeChainId: uint32(8453),
                takeChainReceiver: abi.encodePacked(SUBJECT)
            });
        vm.expectRevert(ProtocolFeeRecorder.Unsupported.selector);
        recorder.onPostCallForCrossChainIntentWithPreSwap(ctx);
    }

    function test_CrossChain_Reverts() public {
        IPostInteractionHook.CrossChainContext memory ctx = IPostInteractionHook.CrossChainContext({
            intentId: INTENT_ID,
            tradeId: TRADE_ID,
            payload: abi.encode(SUBJECT),
            giveToken: GIVE_TOKEN,
            giveAmount: 1,
            takeToken: abi.encodePacked(TAKE_TOKEN),
            takeAmount: 1,
            takeChainId: uint32(8453),
            takeChainReceiver: abi.encodePacked(SUBJECT)
        });
        vm.expectRevert(ProtocolFeeRecorder.Unsupported.selector);
        recorder.onPostCallForCrossChainIntent(ctx);
    }

    function test_AccumulatesAcrossCalls() public {
        recorder.onPostCallForSameChainIntentWithPreSwap(_ctx(600, 400, 970)); // fee=30
        recorder.onPostCallForSameChainIntentWithPreSwap(_ctx(800, 200, 990)); // fee=10
        assertEq(recorder.intentTokenFee(INTENT_ID, TAKE_TOKEN), 40);
        assertEq(recorder.tokenTotalFee(TAKE_TOKEN), 40);
    }
}
