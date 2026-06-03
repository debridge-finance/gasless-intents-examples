// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPreInteractionHook} from "./interfaces/IPreInteractionHook.sol";
import {IPostInteractionHook} from "./interfaces/IPostInteractionHook.sol";
import {IIntentSubmissionView} from "./interfaces/IIntentSubmissionView.sol";
import {IntentManagerCallable} from "./IntentManagerCallable.sol";

/// @title  AllowlistGuard
/// @notice EIP-712 gated allowlist. `onPreCall` decodes the `hookPayload` as
///         `(address subject, bytes32 intentId, bytes32 nonce, uint256 deadline, bytes signature)`,
///         recovers an `AllowlistAuthorization` digest, and reverts unless:
///           1. `block.timestamp <= deadline`,
///           2. the signed intent id matches the callback `intentId`,
///           3. `usedNonces[subject][nonce] == false`,
///           4. the recovered signer equals `subject`,
///           5. `allowed[subject] == true`,
///           6. `subject` has submitted `intentId` to the Intent Manager.
///         On success it marks the nonce used and emits `AllowedCallLogged`.
///
/// @dev Unlike a "decode-subject-only" guard, this design prevents
///      impersonation — only the holder of `subject`'s key can produce a
///      valid signature for that subject, and each signature is single-use
///      (replay-protected by the nonce map).
///
///      Owner ops (`setAllowed` / `setManyAllowed` / `transferOwnership`) are
///      unchanged. No timelock — demo contract.
contract AllowlistGuard is IPreInteractionHook, IPostInteractionHook, IntentManagerCallable {
    error NotOwner();
    error NotAllowed(address subject);
    error ZeroAddress();
    error Expired();
    error InvalidSignatureLength();
    error InvalidSignature();
    error IntentIdMismatch(bytes32 signedIntentId, bytes32 callbackIntentId);
    error IntentNotSubmitted(address subject, bytes32 intentId);
    error NonceUsed();

    event AllowedCallLogged(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address indexed subject,
        bytes32 nonce,
        address sender
    );

    event PostObserved(
        bytes32 indexed intentId,
        bytes32 indexed tradeId,
        address sender
    );

    event AllowedUpdated(address indexed subject, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    string  public constant NAME    = "AllowlistGuard";
    string  public constant VERSION = "1";

    bytes32 public constant ALLOWLIST_AUTHORIZATION_TYPEHASH =
        keccak256("AllowlistAuthorization(address subject,bytes32 intentId,bytes32 nonce,uint256 deadline)");

    bytes32 private constant _EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 private immutable _DOMAIN_SEPARATOR;

    address public owner;
    mapping(address => bool) public allowed;
    mapping(address => mapping(bytes32 => bool)) public usedNonces;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                _EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(NAME)),
                keccak256(bytes(VERSION)),
                block.chainid,
                address(this)
            )
        );
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function decodePayload(bytes calldata hookPayload)
        public
        pure
        returns (
            address subject,
            bytes32 intentId,
            bytes32 nonce,
            uint256 deadline,
            bytes memory signature
        )
    {
        (subject, intentId, nonce, deadline, signature) =
            abi.decode(hookPayload, (address, bytes32, bytes32, uint256, bytes));
    }

    function setAllowed(address subject, bool isAllowed) external onlyOwner {
        allowed[subject] = isAllowed;
        emit AllowedUpdated(subject, isAllowed);
    }

    function setManyAllowed(address[] calldata subjects, bool isAllowed) external onlyOwner {
        uint256 len = subjects.length;
        for (uint256 i; i < len; ++i) {
            allowed[subjects[i]] = isAllowed;
            emit AllowedUpdated(subjects[i], isAllowed);
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
    ) external override onlyIntentManager {
        (
            address subject,
            bytes32 signedIntentId,
            bytes32 nonce,
            uint256 deadline,
            bytes memory signature
        ) =
            decodePayload(hookPayload);

        if (block.timestamp > deadline) revert Expired();
        if (signedIntentId != intentId) revert IntentIdMismatch(signedIntentId, intentId);
        if (usedNonces[subject][nonce]) revert NonceUsed();

        address recovered = _recoverSigner(subject, intentId, nonce, deadline, signature);
        if (recovered == address(0) || recovered != subject) revert InvalidSignature();
        if (!allowed[subject]) revert NotAllowed(subject);
        if (!IIntentSubmissionView(INTENT_MANAGER).isIntentSubmitted(subject, intentId)) {
            revert IntentNotSubmitted(subject, intentId);
        }

        usedNonces[subject][nonce] = true;
        emit AllowedCallLogged(intentId, tradeId, subject, nonce, msg.sender);
    }

    function _recoverSigner(
        address subject,
        bytes32 intentId,
        bytes32 nonce,
        uint256 deadline,
        bytes memory signature
    ) private view returns (address) {
        if (signature.length != 65) revert InvalidSignatureLength();

        bytes32 structHash = keccak256(
            abi.encode(
                ALLOWLIST_AUTHORIZATION_TYPEHASH,
                subject,
                intentId,
                nonce,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        return ecrecover(digest, v, r, s);
    }

    function onPostCallForSameChainIntentWithPreSwap(
        SameChainWithPreSwapChainContext calldata ctx
    ) external override onlyIntentManager {
        emit PostObserved(ctx.intentId, ctx.tradeId, msg.sender);
    }

    function onPostCallForCrossChainIntentWithPreSwap(
        CrossChainWithPreSwapContext calldata ctx
    ) external override onlyIntentManager {
        emit PostObserved(ctx.intentId, ctx.tradeId, msg.sender);
    }

    function onPostCallForCrossChainIntent(
        CrossChainContext calldata ctx
    ) external override onlyIntentManager {
        emit PostObserved(ctx.intentId, ctx.tradeId, msg.sender);
    }
}
