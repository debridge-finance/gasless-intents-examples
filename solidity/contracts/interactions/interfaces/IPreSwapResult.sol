// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Pre-swap leg result, as defined in `final-interactions.md`.
///         Used inside the post-interaction context structs to describe each
///         swap leg executed on the source chain before the trade settles.
interface IPreSwapResult {
    struct PreSwapResult {
        address inputToken;
        uint256 inputAmount;
        uint256 outputAmount;
    }
}
