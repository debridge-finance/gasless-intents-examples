// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPreSwapResult} from "./IPreSwapResult.sol";

/// @notice Post-interaction callback interface. Implementations are invoked by
///         the Intent Manager after a trade settles. The interface matches
///         `final-interactions.md` exactly: structs nested inside the
///         interface, `bytes payload` as the third field of every context,
///         `bytes` for cross-chain token/receiver fields (Solana support),
///         `uint32` for the destination chain id, and a single context-struct
///         argument per callback.
interface IPostInteractionHook {
    struct SameChainWithPreSwapChainContext {
        bytes32 intentId;
        bytes32 tradeId;
        bytes payload;
        IPreSwapResult.PreSwapResult[] preSwapResults;
        address takeToken;
        uint256 takeAmountAfterFeeCharge;
        address receiver;
    }

    struct CrossChainWithPreSwapContext {
        bytes32 intentId;
        bytes32 tradeId;
        bytes payload;
        IPreSwapResult.PreSwapResult[] preSwapResults;
        address giveToken;
        uint256 giveAmount;
        bytes takeToken;
        uint256 takeAmount;
        uint32 takeChainId;
        bytes takeChainReceiver;
    }

    struct CrossChainContext {
        bytes32 intentId;
        bytes32 tradeId;
        bytes payload;
        address giveToken;
        uint256 giveAmount;
        bytes takeToken;
        uint256 takeAmount;
        uint32 takeChainId;
        bytes takeChainReceiver;
    }

    function onPostCallForSameChainIntentWithPreSwap(
        SameChainWithPreSwapChainContext calldata context
    ) external;

    function onPostCallForCrossChainIntentWithPreSwap(
        CrossChainWithPreSwapContext calldata context
    ) external;

    function onPostCallForCrossChainIntent(
        CrossChainContext calldata context
    ) external;
}
