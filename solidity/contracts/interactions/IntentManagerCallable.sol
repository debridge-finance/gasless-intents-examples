// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Shared guard for example interaction hooks.
/// @dev The deBridge IntentManager address is the same across supported chains.
///      Source of truth:
///      https://gasless-docs.debridge.finance/overview/supported-chains
abstract contract IntentManagerCallable {
    error OnlyIntentManager();

    address public constant INTENT_MANAGER =
        0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708;

    modifier onlyIntentManager() {
        _onlyIntentManager();
        _;
    }

    function _onlyIntentManager() internal view {
        if (msg.sender != INTENT_MANAGER) revert OnlyIntentManager();
    }
}
