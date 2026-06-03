// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPreInteractionHook} from "./interfaces/IPreInteractionHook.sol";
import {IPostInteractionHook} from "./interfaces/IPostInteractionHook.sol";
import {IntentManagerCallable} from "./IntentManagerCallable.sol";

/// @title  FillCounter
/// @notice Per-intent, per-subject, and per-token fill metrics, readable via
///         `eth_call`. Decodes `hookPayload` as `abi.encode(address subject)`.
///
/// @dev The cross-chain branches credit `giveAmount` against the source-chain
///      `giveToken`; the same-chain branch credits `takeAmountAfterFeeCharge`
///      against `takeToken`. Mixing same-chain and cross-chain semantics in one
///      counter is intentional so the same contract can power any volume
///      leaderboard.
contract FillCounter is IPreInteractionHook, IPostInteractionHook, IntentManagerCallable {
    event FillRecorded(
        bytes32 indexed intentId,
        address indexed subject,
        address indexed token,
        uint256 intentFillNumber,
        uint256 lifetimeFills,
        uint256 lifetimeGiveAmount,
        uint256 lifetimeTokenAmount,
        uint256 amountAdded
    );

    mapping(bytes32 => uint256) public intentFillCount;
    mapping(address => uint256) public lifetimeFills;
    mapping(address => uint256) public lifetimeGiveAmount;
    mapping(address => mapping(address => uint256)) public lifetimeGiveAmountByToken;

    function decodePayload(bytes calldata hookPayload) public pure returns (address subject) {
        subject = abi.decode(hookPayload, (address));
    }

    function getStats(address subject) external view returns (uint256 fills, uint256 giveTotal) {
        return (lifetimeFills[subject], lifetimeGiveAmount[subject]);
    }

    function onPreCall(
        bytes32 intentId,
        bytes32, /* tradeId */
        bytes calldata hookPayload
    ) external override onlyIntentManager {
        address subject = decodePayload(hookPayload);
        intentFillCount[intentId] += 1;
        lifetimeFills[subject] += 1;
        emit FillRecorded(
            intentId,
            subject,
            address(0),
            intentFillCount[intentId],
            lifetimeFills[subject],
            lifetimeGiveAmount[subject],
            0,
            0
        );
    }

    function onPostCallForSameChainIntentWithPreSwap(
        SameChainWithPreSwapChainContext calldata ctx
    ) external override onlyIntentManager {
        address subject = decodePayload(ctx.payload);
        uint256 amount = ctx.takeAmountAfterFeeCharge;
        lifetimeGiveAmount[subject] += amount;
        lifetimeGiveAmountByToken[subject][ctx.takeToken] += amount;
        emit FillRecorded(
            ctx.intentId,
            subject,
            ctx.takeToken,
            intentFillCount[ctx.intentId],
            lifetimeFills[subject],
            lifetimeGiveAmount[subject],
            lifetimeGiveAmountByToken[subject][ctx.takeToken],
            amount
        );
    }

    function onPostCallForCrossChainIntentWithPreSwap(
        CrossChainWithPreSwapContext calldata ctx
    ) external override onlyIntentManager {
        address subject = decodePayload(ctx.payload);
        uint256 amount = ctx.giveAmount;
        lifetimeGiveAmount[subject] += amount;
        lifetimeGiveAmountByToken[subject][ctx.giveToken] += amount;
        emit FillRecorded(
            ctx.intentId,
            subject,
            ctx.giveToken,
            intentFillCount[ctx.intentId],
            lifetimeFills[subject],
            lifetimeGiveAmount[subject],
            lifetimeGiveAmountByToken[subject][ctx.giveToken],
            amount
        );
    }

    function onPostCallForCrossChainIntent(
        CrossChainContext calldata ctx
    ) external override onlyIntentManager {
        address subject = decodePayload(ctx.payload);
        uint256 amount = ctx.giveAmount;
        lifetimeGiveAmount[subject] += amount;
        lifetimeGiveAmountByToken[subject][ctx.giveToken] += amount;
        emit FillRecorded(
            ctx.intentId,
            subject,
            ctx.giveToken,
            intentFillCount[ctx.intentId],
            lifetimeFills[subject],
            lifetimeGiveAmount[subject],
            lifetimeGiveAmountByToken[subject][ctx.giveToken],
            amount
        );
    }
}
