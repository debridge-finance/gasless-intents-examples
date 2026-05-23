// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Demo-only interface. The real Intent Manager calls hooks with this
///         selector; the field shape will match exactly once the submit
///         endpoint is wired end-to-end. Until then these contracts deploy
///         and can be exercised by direct calls.
interface IPreInteractionHook {
    function onPreCall(
        bytes32 intentId,
        bytes32 tradeId,
        bytes calldata hookPayload
    ) external;
}
