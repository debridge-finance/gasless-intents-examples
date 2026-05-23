// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPreInteractionHook} from "./interfaces/IPreInteractionHook.sol";
import {IPostInteractionHook} from "./interfaces/IPostInteractionHook.sol";

/// @title  FillCapEnforcer
/// @notice Hard-cap counterpart to `LoggingInteractionHook`'s soft cap.
///         `onPreCall` decodes `abi.encode(address subject)`, increments the
///         per-intent fill counter, and reverts with `HardCapExceeded` once
///         `fills[intentId] > caps[subject]`. `caps[subject] == 0` means no
///         cap (the default — set explicitly with `setCap`).
///
/// @dev Owner-gated `setCap` / `setManyCaps` / `transferOwnership`. Post-call
///      variants are observation-only. No timelock — demo contract.
contract FillCapEnforcer is IPreInteractionHook, IPostInteractionHook {
    error NotOwner();
    error ZeroAddress();
    error HardCapExceeded(address subject, uint256 cap, uint256 attempted);

    event CapUpdated(address indexed subject, uint256 cap);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event PreCallAccepted(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address indexed subject,
        uint256 fillNumber,
        uint256 cap,
        address sender
    );

    event PostObserved(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address sender
    );

    address public owner;
    mapping(address => uint256) public caps;
    mapping(bytes32 => uint256) public fills;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function decodePayload(bytes calldata hookPayload) public pure returns (address subject) {
        subject = abi.decode(hookPayload, (address));
    }

    function setCap(address subject, uint256 maxFills) external onlyOwner {
        caps[subject] = maxFills;
        emit CapUpdated(subject, maxFills);
    }

    function setManyCaps(address[] calldata subjects, uint256 maxFills) external onlyOwner {
        uint256 len = subjects.length;
        for (uint256 i; i < len; ++i) {
            caps[subjects[i]] = maxFills;
            emit CapUpdated(subjects[i], maxFills);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    function onPreCall(
        bytes32 intentId,
        bytes32 tradeId,
        bytes calldata hookPayload
    ) external override {
        address subject = decodePayload(hookPayload);
        uint256 cap = caps[subject];
        uint256 fillNumber = ++fills[intentId];
        if (cap != 0 && fillNumber > cap) {
            revert HardCapExceeded(subject, cap, fillNumber);
        }
        emit PreCallAccepted(intentId, tradeId, subject, fillNumber, cap, msg.sender);
    }

    function onPostCallForSameChainIntentWithPreSwap(
        SameChainWithPreSwapChainContext calldata ctx
    ) external override {
        emit PostObserved(ctx.intentId, ctx.tradeId, msg.sender);
    }

    function onPostCallForCrossChainIntentWithPreSwap(
        CrossChainWithPreSwapContext calldata ctx
    ) external override {
        emit PostObserved(ctx.intentId, ctx.tradeId, msg.sender);
    }

    function onPostCallForCrossChainIntent(
        CrossChainContext calldata ctx
    ) external override {
        emit PostObserved(ctx.intentId, ctx.tradeId, msg.sender);
    }
}
