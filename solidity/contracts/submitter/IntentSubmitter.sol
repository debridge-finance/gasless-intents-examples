// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/token/ERC20/utils/SafeERC20.sol";

import {IIntent} from "../debridge/interfaces/IIntent.sol";
import {IIntentManager} from "../debridge/interfaces/IIntentManager.sol";

/// @title IntentSubmitter — example of direct on-chain intent submission.
/// @notice Forwards a caller-built `IIntent.Intent` to the deBridge
///         IntentManager, enforcing: the receiver must be {RECIPIENT}, the
///         destination-chain cancel authority must be the {owner}, no chain id
///         may be Solana or TRON (deBridge internal ids), `intentChainId` must
///         match the manager's internal chain id, and the expiration must fall
///         within {MAX_INTENT_TTL}.
/// @dev The contract is the intent owner and the account charged on fill:
///      fund it with the input token before submitting. The AllowanceHolder
///      approval happens inside {submitIntent}, so no separate approval
///      transaction is needed. For demonstration purposes only.
contract IntentSubmitter {
    using SafeERC20 for IERC20;

    /// @notice deBridge IntentManager and AllowanceHolder (same addresses on
    ///         all supported EVM chains).
    address public constant INTENT_MANAGER =
        0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708;
    address public constant ALLOWANCE_HOLDER =
        0xddddddddd4B6472c5002F95610b194D1161223d0;

    /// @notice The only allowed take-token recipient.
    address public constant RECIPIENT =
        0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8;

    /// @notice Banned chains (deBridge internal chain ids).
    uint32 public constant SOLANA_CHAIN_ID = 7565164;
    uint32 public constant TRON_CHAIN_ID = 100000026;

    /// @notice Longest allowed intent lifetime at submission.
    uint64 public constant MAX_INTENT_TTL = 30 days;

    address public immutable owner;

    error NotOwner(address caller);
    error IntentOwnerMustBeThisContract(address intentOwner);
    error NoReceiver();
    error RecipientNotAllowed(bytes receiver);
    error ChainNotAllowed(uint32 chainId);
    error WildcardChainNotAllowed();
    error ZeroChainId();
    error WrongIntentChain(uint32 intentChainId);
    error InvalidExpiration(uint64 expirationTimestamp);
    error NoDstAuthority();
    error DstAuthorityNotOwner(bytes dstAuthority);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Validate and submit the intent; returns its id. Grants the
    ///         AllowanceHolder a one-time max approval per input token (skipped
    ///         when the allowance already covers the budget), so submission is
    ///         a single transaction.
    function submitIntent(IIntent.Intent calldata intent)
        external
        onlyOwner
        returns (bytes32 intentId)
    {
        _validate(intent);

        for (uint256 i; i < intent.inputToken.length; ++i) {
            IERC20 token = IERC20(intent.inputToken[i].token);
            if (
                token.allowance(address(this), ALLOWANCE_HOLDER) <
                intent.inputToken[i].budget
            ) {
                token.forceApprove(ALLOWANCE_HOLDER, type(uint256).max);
            }
        }

        intentId = keccak256(abi.encode(intent));
        IIntentManager(INTENT_MANAGER).submitIntent(intent);
    }

    /// @notice Revoke a previously submitted intent.
    /// @dev The manager emits `SubmittedIntentRevoked`; no local event needed.
    function revokeIntent(bytes32 intentId) external onlyOwner {
        IIntentManager(INTENT_MANAGER).revokeSubmittedIntentById(intentId);
    }

    /// @notice Bulk revocation: nullifies every intent from this contract with
    ///         `intentTimestamp <= timestamp`.
    /// @dev Manager rules: `timestamp` must not be in the future and can only
    ///      increase. Irreversible — also kills a later submission whose
    ///      `intentTimestamp` falls at or below `timestamp`.
    function revokeIntentsUpTo(uint256 timestamp) external onlyOwner {
        IIntentManager(INTENT_MANAGER).setNullificationTimestamp(timestamp);
    }

    /// @notice Mirror of the manager's submission flag for this contract.
    /// @dev Not a fill signal — the flag stays true after a fill.
    function isIntentSubmitted(bytes32 intentId) external view returns (bool) {
        return
            IIntentManager(INTENT_MANAGER).isIntentSubmitted(
                address(this),
                intentId
            );
    }

    /// @notice Recover tokens held by the contract.
    function rescue(address token, address to, uint256 amount)
        external
        onlyOwner
    {
        IERC20(token).safeTransfer(to, amount);
    }

    function _validate(IIntent.Intent calldata intent) private view {
        if (intent.intentOwner != address(this))
            revert IntentOwnerMustBeThisContract(intent.intentOwner);

        if (
            intent.expirationTimestamp <= block.timestamp ||
            intent.expirationTimestamp > block.timestamp + MAX_INTENT_TTL
        ) revert InvalidExpiration(intent.expirationTimestamp);

        _requireAllowedChain(intent.intentChainId);

        // The intent must target the chain it is submitted on — compared
        // against the manager's deBridge INTERNAL chain id (may differ from
        // block.chainid), otherwise it is authorized but never fillable.
        if (
            intent.intentChainId !=
            IIntentManager(INTENT_MANAGER).getChainId()
        ) revert WrongIntentChain(intent.intentChainId);

        if (intent.receiverDetails.length == 0) revert NoReceiver();
        bytes32 recipientHash = keccak256(abi.encodePacked(RECIPIENT));
        for (uint256 i; i < intent.receiverDetails.length; ++i) {
            IIntent.AllowedAddress calldata receiver = intent.receiverDetails[i];
            if (keccak256(receiver.allowedAddress) != recipientHash)
                revert RecipientNotAllowed(receiver.allowedAddress);
            if (receiver.isAnyChain) revert WildcardChainNotAllowed();
            for (uint256 j; j < receiver.chains.length; ++j) {
                _requireAllowedChain(receiver.chains[j]);
            }
        }

        for (uint256 i; i < intent.takeToken.length; ++i) {
            uint32 takeChain = intent.takeToken[i].takeTokenChain;
            if (takeChain == 0) revert ZeroChainId();
            _requireAllowedChain(takeChain);
        }

        // Pin the destination-chain cancel authority to the owner, so a
        // need-be DLN-order cancellation can always be initiated by an
        // address the user controls.
        if (intent.dstAuthorityAddress.length == 0) revert NoDstAuthority();
        bytes32 ownerHash = keccak256(abi.encodePacked(owner));
        for (uint256 i; i < intent.dstAuthorityAddress.length; ++i) {
            bytes calldata authority =
                intent.dstAuthorityAddress[i].allowedAddress;
            if (keccak256(authority) != ownerHash)
                revert DstAuthorityNotOwner(authority);
        }
    }

    function _requireAllowedChain(uint32 chainId) private pure {
        if (chainId == SOLANA_CHAIN_ID || chainId == TRON_CHAIN_ID)
            revert ChainNotAllowed(chainId);
    }
}
