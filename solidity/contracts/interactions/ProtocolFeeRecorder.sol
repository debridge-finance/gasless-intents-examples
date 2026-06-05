// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPreInteractionHook} from "./interfaces/IPreInteractionHook.sol";
import {IPostInteractionHook} from "./interfaces/IPostInteractionHook.sol";
import {IPreSwapResult} from "./interfaces/IPreSwapResult.sol";
import {IntentManagerCallable} from "./IntentManagerCallable.sol";

/// @title  ProtocolFeeRecorder
/// @notice Same-chain-with-pre-swap fee derivation:
///         `feeAmount = Σ preSwapResults[i].outputAmount − ctx.takeAmountAfterFeeCharge`.
///         Stores per-intent and per-token cumulative fees, emits one event
///         per fill. The cross-chain variants are accepted as no-ops because
///         cross-chain post-hooks don't receive the data needed to derive the
///         analogous fee.
///
/// @dev Decodes `hookPayload` as `abi.encode(address subject)`. `subject` is
///      recorded alongside the fee for off-chain attribution (e.g. referrer
///      or partner accounting).
contract ProtocolFeeRecorder is IPreInteractionHook, IPostInteractionHook, IntentManagerCallable {
    event ProtocolFeeRecorded(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address indexed takeToken,
        address subject,
        uint256 totalPreSwapOutput,
        uint256 takeAmountAfterFeeCharge,
        uint256 feeAmount,
        uint256 feeBps
    );

    /// @notice Per-(intentId, token) recorded fee.
    mapping(bytes32 => mapping(address => uint256)) public intentTokenFee;
    /// @notice Per-token cumulative fee across all observed fills.
    mapping(address => uint256) public tokenTotalFee;

    function decodePayload(bytes calldata hookPayload) public pure returns (address subject) {
        subject = abi.decode(hookPayload, (address));
    }

    function onPreCall(
        bytes32, /* intentId */
        bytes32, /* tradeId */
        bytes calldata /* hookPayload */
    ) external view override onlyIntentManager {
        // No-op: this recorder only cares about post-call data. The interface
        // is still implemented so the same address can be referenced in both
        // `preInteractions` and `postInteractions` arrays without tripping a
        // "selector not found" call.
    }

    function onPostCallForSameChainIntentWithPreSwap(
        SameChainWithPreSwapChainContext calldata ctx
    ) external override onlyIntentManager {
        address subject = decodePayload(ctx.payload);

        uint256 totalOutput = _sumOutputs(ctx.preSwapResults);
        uint256 feeAmount = totalOutput >= ctx.takeAmountAfterFeeCharge
            ? totalOutput - ctx.takeAmountAfterFeeCharge
            : 0;
        uint256 feeBps = totalOutput == 0 ? 0 : (feeAmount * 10_000) / totalOutput;

        intentTokenFee[ctx.intentId][ctx.takeToken] += feeAmount;
        tokenTotalFee[ctx.takeToken] += feeAmount;

        emit ProtocolFeeRecorded(
            ctx.intentId,
            ctx.tradeId,
            ctx.takeToken,
            subject,
            totalOutput,
            ctx.takeAmountAfterFeeCharge,
            feeAmount,
            feeBps
        );
    }

    function onPostCallForCrossChainIntentWithPreSwap(
        CrossChainWithPreSwapContext calldata /* ctx */
    ) external view override onlyIntentManager {
        // No-op: cross-chain contexts don't expose same-chain fee derivation data.
    }

    function onPostCallForCrossChainIntent(
        CrossChainContext calldata /* ctx */
    ) external view override onlyIntentManager {
        // No-op: cross-chain contexts don't expose same-chain fee derivation data.
    }

    function _sumOutputs(IPreSwapResult.PreSwapResult[] calldata legs) private pure returns (uint256 total) {
        uint256 len = legs.length;
        for (uint256 i; i < len; ++i) {
            total += legs[i].outputAmount;
        }
    }
}
