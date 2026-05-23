// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPreInteractionHook} from "./interfaces/IPreInteractionHook.sol";
import {IPostInteractionHook} from "./interfaces/IPostInteractionHook.sol";
import {IPreSwapResult} from "./interfaces/IPreSwapResult.sol";

/// @title  LoggingInteractionHook
/// @notice Implements both interaction-hook interfaces and emits an event for
///         every callback. Canonical observability target for the gasless-
///         intents examples.
///
/// @dev Hook payload schema: abi.encode(string label, address subject, uint256 referenceId).
///      `referenceId > 0` is a SOFT fill-count cap — `onPreCall` flips
///      `rateLimitExceeded = true` once `fillCount[intentId] > referenceId`
///      but never reverts. For hard caps see `FillCapEnforcer`.
///
///      Callbacks have no access control: any caller may invoke them. A
///      production deployment should gate `onPreCall` / `onPostCall*` with
///      `onlyIntentManager`.
contract LoggingInteractionHook is IPreInteractionHook, IPostInteractionHook {
    struct Decoded {
        string label;
        address subject;
        uint256 referenceId;
    }

    event PreCallLogged(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address indexed subject,
        string label,
        uint256 referenceId,
        uint256 fillNumber,
        bool rateLimitExceeded,
        address sender,
        uint256 timestamp
    );

    event PostCallSameChainLogged(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address indexed subject,
        string label,
        uint256 referenceId,
        address takeToken,
        uint256 takeAmountAfterFeeCharge,
        address receiver,
        address sender,
        uint256 timestamp
    );

    event PostCallCrossChainPreSwapLogged(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address indexed subject,
        string label,
        uint256 referenceId,
        address giveToken,
        uint256 giveAmount,
        bytes takeToken,
        uint256 takeAmount,
        uint32 takeChainId,
        bytes takeChainReceiver,
        address sender,
        uint256 timestamp
    );

    event PostCallCrossChainLogged(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address indexed subject,
        string label,
        uint256 referenceId,
        address giveToken,
        uint256 giveAmount,
        bytes takeToken,
        uint256 takeAmount,
        uint32 takeChainId,
        bytes takeChainReceiver,
        address sender,
        uint256 timestamp
    );

    event PreSwapLegLogged(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        uint256 legIndex,
        address inputToken,
        uint256 inputAmount,
        uint256 outputAmount
    );

    event PreSwapAggregateLogged(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        uint256 legCount,
        uint256 totalOutputAmount
    );

    event ProtocolFeeLogged(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        uint256 totalPreSwapOutput,
        uint256 takeAmountAfterFeeCharge,
        uint256 feeAmount,
        uint256 feeBps
    );

    mapping(bytes32 => uint256) public fillCount;
    mapping(bytes32 => uint256) public cumulativeGiveAmount;

    function decodePayload(bytes calldata hookPayload) public pure returns (Decoded memory) {
        (string memory label, address subject, uint256 referenceId) =
            abi.decode(hookPayload, (string, address, uint256));
        return Decoded(label, subject, referenceId);
    }

    function onPreCall(
        bytes32 intentId,
        bytes32 tradeId,
        bytes calldata hookPayload
    ) external override {
        Decoded memory d = decodePayload(hookPayload);
        uint256 fillNumber = ++fillCount[intentId];
        bool exceeded = d.referenceId > 0 && fillNumber > d.referenceId;

        emit PreCallLogged(
            intentId,
            tradeId,
            d.subject,
            d.label,
            d.referenceId,
            fillNumber,
            exceeded,
            msg.sender,
            block.timestamp
        );
    }

    function onPostCallForSameChainIntentWithPreSwap(
        SameChainWithPreSwapChainContext calldata ctx
    ) external override {
        Decoded memory d = decodePayload(ctx.payload);

        uint256 totalOutput = _logPreSwapLegs(ctx.intentId, ctx.tradeId, ctx.preSwapResults);

        if (totalOutput >= ctx.takeAmountAfterFeeCharge) {
            uint256 feeAmount = totalOutput - ctx.takeAmountAfterFeeCharge;
            uint256 feeBps = totalOutput == 0 ? 0 : (feeAmount * 10_000) / totalOutput;
            emit ProtocolFeeLogged(
                ctx.intentId,
                ctx.tradeId,
                totalOutput,
                ctx.takeAmountAfterFeeCharge,
                feeAmount,
                feeBps
            );
        }

        emit PostCallSameChainLogged(
            ctx.intentId,
            ctx.tradeId,
            d.subject,
            d.label,
            d.referenceId,
            ctx.takeToken,
            ctx.takeAmountAfterFeeCharge,
            ctx.receiver,
            msg.sender,
            block.timestamp
        );
    }

    function onPostCallForCrossChainIntentWithPreSwap(
        CrossChainWithPreSwapContext calldata ctx
    ) external override {
        Decoded memory d = decodePayload(ctx.payload);

        _logPreSwapLegs(ctx.intentId, ctx.tradeId, ctx.preSwapResults);
        cumulativeGiveAmount[ctx.intentId] += ctx.giveAmount;

        emit PostCallCrossChainPreSwapLogged(
            ctx.intentId,
            ctx.tradeId,
            d.subject,
            d.label,
            d.referenceId,
            ctx.giveToken,
            ctx.giveAmount,
            ctx.takeToken,
            ctx.takeAmount,
            ctx.takeChainId,
            ctx.takeChainReceiver,
            msg.sender,
            block.timestamp
        );
    }

    function onPostCallForCrossChainIntent(
        CrossChainContext calldata ctx
    ) external override {
        Decoded memory d = decodePayload(ctx.payload);
        cumulativeGiveAmount[ctx.intentId] += ctx.giveAmount;

        emit PostCallCrossChainLogged(
            ctx.intentId,
            ctx.tradeId,
            d.subject,
            d.label,
            d.referenceId,
            ctx.giveToken,
            ctx.giveAmount,
            ctx.takeToken,
            ctx.takeAmount,
            ctx.takeChainId,
            ctx.takeChainReceiver,
            msg.sender,
            block.timestamp
        );
    }

    function _logPreSwapLegs(
        bytes32 intentId,
        bytes32 tradeId,
        IPreSwapResult.PreSwapResult[] calldata legs
    ) private returns (uint256 totalOutput) {
        uint256 len = legs.length;
        for (uint256 i; i < len; ++i) {
            emit PreSwapLegLogged(
                intentId,
                tradeId,
                i,
                legs[i].inputToken,
                legs[i].inputAmount,
                legs[i].outputAmount
            );
            totalOutput += legs[i].outputAmount;
        }
        emit PreSwapAggregateLogged(intentId, tradeId, len, totalOutput);
    }
}
