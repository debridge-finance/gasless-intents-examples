// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title  EchoWithSig
/// @notice Verifies an EIP-712-signed message and emits an event with the message
///         and signature. Tracks per-user nonces so the same signature can't be
///         replayed. No funds, no approvals — pure permission-slip demo for
///         deBridge `direct + deferred` solver hooks.
contract EchoWithSig {
    event MessageEchoed(
        address indexed user,
        bytes32 indexed nonce,
        string message,
        bytes signature
    );

    string  public constant NAME    = "EchoWithSig";
    string  public constant VERSION = "1";

    bytes32 public constant ECHO_MESSAGE_TYPEHASH =
        keccak256("EchoMessage(address user,bytes32 nonce,string message,uint256 deadline)");

    bytes32 private constant _EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 private immutable _DOMAIN_SEPARATOR;

    mapping(address => mapping(bytes32 => bool)) public usedNonces;

    constructor() {
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                _EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(NAME)),
                keccak256(bytes(VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function echoWithSig(
        address user,
        bytes32 nonce,
        string calldata message,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "Echo: expired");
        require(!usedNonces[user][nonce], "Echo: nonce used");
        require(signature.length == 65, "Echo: bad sig length");

        bytes32 structHash = keccak256(
            abi.encode(
                ECHO_MESSAGE_TYPEHASH,
                user,
                nonce,
                keccak256(bytes(message)),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        address recovered = ecrecover(digest, v, r, s);
        require(recovered != address(0) && recovered == user, "Echo: bad sig");

        usedNonces[user][nonce] = true;
        emit MessageEchoed(user, nonce, message, signature);
    }
}
