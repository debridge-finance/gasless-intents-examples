// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IIntentSubmissionView {
    function isIntentSubmitted(
        address intentOwner,
        bytes32 intentId
    ) external view returns (bool);
}
