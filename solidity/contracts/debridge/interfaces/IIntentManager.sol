// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IIntent} from "./IIntent.sol";

/// @notice Thin calling interface for the deBridge IntentManager entrypoints
///         used by the example contracts.
/// @dev Structs are reused from {IIntent} and never re-declared:
///      `intentId = keccak256(abi.encode(intent))`, so they must stay
///      byte-identical to the deployed contract.
interface IIntentManager {
    /// @notice Submit a full intent. Sets
    ///         `submittedIntents[msg.sender][intentId] = true`, so the caller
    ///         becomes both `intentOwner` and submitter.
    function submitIntent(IIntent.Intent calldata intent) external;

    /// @notice Instantly revoke a previously submitted intent by id
    ///         (`submittedIntents[msg.sender][intentId] = false`).
    function revokeSubmittedIntentById(bytes32 intentId) external;

    /// @notice Mass-kill: invalidates intents with
    ///         `intentTimestamp <= nullificationTimestamp` for `msg.sender`.
    function setNullificationTimestamp(uint256 nullificationTimestamp) external;

    /// @notice Current nullification timestamp for `intentOwnerOrAuthority`.
    function getNullificationTimestamp(
        address intentOwnerOrAuthority
    ) external view returns (uint256);

    /// @notice The deBridge internal chain id of this deployment (differs from
    ///         `block.chainid` on some chains).
    function getChainId() external view returns (uint32);

    /// @notice Cancel an intent by id (`canceledIntents[msg.sender][intentId] = true`).
    function cancelIntent(bytes32 intentId) external;

    /// @notice Whether `intentId` is currently submitted by `intentOwner`.
    function isIntentSubmitted(
        address intentOwner,
        bytes32 intentId
    ) external view returns (bool);
}
