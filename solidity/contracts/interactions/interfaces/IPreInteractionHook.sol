// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Pre-interaction callback interface invoked by the Intent Manager.
///         The selector and field shape match the current Intent Manager
///         callback interface.
interface IPreInteractionHook {
    function onPreCall(
        bytes32 intentId,
        bytes32 tradeId,
        bytes calldata hookPayload
    ) external;
}
