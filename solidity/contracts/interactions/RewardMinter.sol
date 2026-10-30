// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPreInteractionHook} from "./interfaces/IPreInteractionHook.sol";
import {IPostInteractionHook} from "./interfaces/IPostInteractionHook.sol";
import {IntentManagerCallable} from "./IntentManagerCallable.sol";

/// @title  RewardMinter
/// @notice Accrues per-subject reward points. Every interaction callback
///         decodes `abi.encode(address subject, uint256 reward)` from the
///         payload and credits `reward` to `rewards[subject]`.
///
/// @dev Non-transferrable, non-mintable receipt — purely a counter. To issue
///      ERC20 rewards, fork and replace the storage write with `_mint`.
contract RewardMinter is IPreInteractionHook, IPostInteractionHook, IntentManagerCallable {
    event RewardEarned(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address indexed subject,
        uint256 reward,
        uint256 totalRewards,
        address sender
    );

    mapping(address => uint256) public rewards;

    function decodePayload(bytes calldata hookPayload)
        public
        pure
        returns (address subject, uint256 reward)
    {
        (subject, reward) = abi.decode(hookPayload, (address, uint256));
    }

    function onPreCall(
        bytes32 intentId,
        bytes32 tradeId,
        bytes calldata hookPayload
    ) external override onlyIntentManager {
        _credit(intentId, tradeId, hookPayload);
    }

    function onPostCallForSameChainIntentWithPreSwap(
        SameChainWithPreSwapChainContext calldata ctx
    ) external override onlyIntentManager {
        _credit(ctx.intentId, ctx.tradeId, ctx.payload);
    }

    function onPostCallForCrossChainIntentWithPreSwap(
        CrossChainWithPreSwapContext calldata ctx
    ) external override onlyIntentManager {
        _credit(ctx.intentId, ctx.tradeId, ctx.payload);
    }

    function onPostCallForCrossChainIntent(
        CrossChainContext calldata ctx
    ) external override onlyIntentManager {
        _credit(ctx.intentId, ctx.tradeId, ctx.payload);
    }

    function _credit(bytes32 intentId, bytes32 tradeId, bytes calldata payload) private {
        (address subject, uint256 reward) = decodePayload(payload);
        rewards[subject] += reward;
        emit RewardEarned(intentId, tradeId, subject, reward, rewards[subject], msg.sender);
    }
}
