// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IIntent {
    /// @dev Structure that defines an allowed address on specific chains.
    struct AllowedAddress {
        /// @dev The allowed address in bytes format.
        bytes allowedAddress;
        /// @dev List of chain IDs where the address is allowed.
        /// If isAnyChain is true, this field is ignored.
        uint32[] chains;
        /// @dev If true, the address is allowed on any chain.
        bool isAnyChain;
    }

    /// @dev Constraint that defines an allowed input token with its budget and
    /// min/max partial amounts.
    struct InputToken {
        /// @dev The input token address.
        address token;
        /// @dev The minimum partial amount that can be used in a single
        /// fulfillment.
        /// @dev May be bypassed in case when the entire remaining budget is
        /// being spent.
        uint256 minPartialAmount;
        /// @dev The maximum partial amount that can be used in a single
        /// fulfillment.
        uint256 maxPartialAmount;
        /// @dev The initial total budget that can be spent from this input
        /// token.
        /// @dev The budget is decremented with each fulfillment. The leftover
        /// budget amount is stored in the contract.
        uint256 budget;
    }

    /// @dev Constraint that defines the acceptable pair of input token and
    /// give token with its acceptable minimum price.
    struct GiveTokenConstraint {
        /// @dev The input token for which this constraint is defined.
        /// @dev May be set to ANY_ADDRESS to define a constraint for any input
        /// token.
        /// @dev If set to ANY_ADDRESS, the numerator and denominator will be
        /// ignored.
        address inputToken;
        /// @dev The give token for which this constraint is defined.
        /// @dev Must NOT be ANY_ADDRESS.
        /// @dev If equal to inputToken, the numerator and denominator will be
        /// ignored.
        address giveToken;
        /// @dev The giveToken amount that corresponds to (10 ** denominator) of
        /// the inputToken amount.
        /// @dev May be set to zero to define a constraint that does not
        /// restrict the price.
        /// @dev If set to zero, the denominator will be ignored.
        uint256 numerator;
        /// @dev The inputToken decimals.
        uint8 denominator;
    }

    /// @dev Constraint that defines the acceptable pair of give token and take
    /// token with its acceptable minimum price.
    struct TakeTokenConstraint {
        /// @dev The give token for which this constraint is defined.
        /// @dev Must NOT be ANY_ADDRESS.
        address giveToken;
        /// @dev Chain ID for the take token.
        /// @dev May be set to ANY_CHAIN_ID to define a constraint for any take
        /// token chain.
        /// @dev If set to ANY_CHAIN_ID, the takeToken, numerator, and
        /// denominator will be ignored.
        uint32 takeTokenChain;
        /// @dev The take token address, in bytes format, for which this
        /// constraint is defined.
        /// @dev May be set to empty bytes array to define a constraint for any
        /// take token on the specified takeTokenChain.
        /// @dev If set to empty bytes array, the numerator and denominator will
        /// be ignored.
        bytes takeToken;
        /// @dev The takeToken amount that corresponds to (10 ** denominator) of
        /// the giveToken amount.
        /// @dev May be set to zero to define a constraint that does not
        /// restrict the price.
        /// @dev If set to zero, the denominator will be ignored.
        uint256 numerator;
        /// @dev The giveToken decimals.
        uint8 denominator;
    }

    /// @dev Main structure that defines an intent with all its constraints and
    /// metadata.
    struct Intent {
        /// @dev Intent may be only executed on the chain with this ID.
        uint32 intentChainId;
        /// @dev Intent owner address. The authority that either signs the
        /// intent or delegates signing authority to a delegator. The intent
        /// owner is the account charged during the fulfillment of the intent’s
        /// trade.
        /// @dev Zero address is invalid.
        address intentOwner;
        /// @dev Mandatory list of allowed addresses that can receive the take
        /// token.
        AllowedAddress[] receiverDetails;
        /// @dev Mandatory list of allowed input tokens with their budgets and
        /// min/max partial amounts.
        /// @dev If multiple constraints match during fulfillment, the first one
        /// with matched input token address will be applied.
        InputToken[] inputToken;
        /// @dev List of allowed pairs of input tokens and give tokens with
        /// their acceptable minimum prices.
        /// @dev This list may be empty for intents that do not need any
        /// cross-chain pre-swap operations.
        /// @dev If multiple constraints match during fulfillment (same pair of
        /// inputToken and giveToken), the first one will be applied.
        GiveTokenConstraint[] giveToken;
        /// @dev Mandatory list of allowed pairs of give tokens and take tokens
        /// with their acceptable minimum prices.
        /// @dev For same-chain trades the giveToken entity is not used, and the
        /// inputToken(s) are treated as giveTokens.
        /// @dev If multiple constraints match during fulfillment (same set of
        /// giveToken, takeTokenChain and takeToken), the first one will be
        /// applied.
        TakeTokenConstraint[] takeToken;
        /// @dev Timestamp when the intent expires.
        uint64 expirationTimestamp;
        /// @dev Timestamp when the intent was created. Can be used  to perform
        /// mass intent cancellations by increasing the minimum acceptable
        /// timestamp by intentOwner or intentAuthority - per intent owner, or
        /// by the admin - globally.
        uint64 intentTimestamp;
        /// @dev Optional list of addresses that restricts who can fulfill the
        /// intent.
        /// @dev If empty, any address can fulfill the intent.
        address[] srcAllowedSender;
        /// @dev The metadata that will be emitted in the event during each
        /// intent fulfillment.
        bytes executionMetadata;
        /// @dev If true, any DLN metadata is allowed to be passed to the DLN
        /// order.
        bool isAnyDlnMetadataAllowed;
        /// @dev The metadata that will be passed to DLN order if
        /// isAnyDlnMetadataAllowed is false.
        bytes dlnMetadata;
        /// @dev Hash of the optional external call that should be passed to DLN
        /// order.
        /// @dev If set to zero, it indicates that the intent does not
        /// restrict the external call, and any external call can be used.
        /// @dev If set to non-zero, it indicates that the intent restricts the
        /// external call, and only the external call with matching hash can be
        /// used.
        bytes32 externalCallHash;

        /// @dev Optional combined interactions envelope that includes
        /// preInteractions, postInteractions, and validationRules.
        /// @dev See the encoding format in InteractionLib.
        /// @dev validationRules - optional chain-specific custom rules envelope
        /// that a smart contract may use to validate the intent before each
        /// fulfillment. At the moment, this field is not used. It is a
        /// placeholder for future implementation.
        /// @dev preInteractions - optional actions that should be executed
        /// before the intent fulfillment (including partial fulfillment).
        /// @dev postInteractions - optional actions that should be executed
        /// after the intent fulfillment (including partial fulfillment).
        bytes combinedInteractions;

        /// @dev Optional wallet address in the source chain that is authorized
        /// to receive the give token in case of DLN order cancellation.
        /// @dev If set to zero address, no cancel beneficiary is allowed in the
        /// DLN order.
        address allowedCancelBeneficiary;

        /// @dev Mandatory list of addresses on the destination chain that are
        /// authorized to cancel the DLN order.
        AllowedAddress[] dstAuthorityAddress;

        /// @dev Optional additional authority that can cancel the intent.
        /// @dev If set to zero address, no additional authority for the intent.
        address intentAuthority;
    }

    /// @dev Lightweight constraint that defines the acceptable take token with
    /// its acceptable minimum price.
    struct SingleSameChainTakeTokenConstraint {
        /// @dev The take token address.
        /// @dev May be set to ANY_ADDRESS to define a constraint for any take
        /// token on current chain.
        /// @dev If set to ANY_ADDRESS, the numerator and denominator will be
        /// ignored.
        address takeToken;
        /// @dev The takeToken amount that corresponds to (10 ** denominator) of
        /// the inputToken amount.
        /// @dev May be set to zero to define a constraint that does not
        /// restrict the price.
        /// @dev If set to zero, the denominator will be ignored.
        uint256 numerator;
        /// @dev The inputToken decimals.
        uint8 denominator;
    }

    /// @dev Lightweight structure for one-to-one same-chain intents.
    /// @dev See the description of each field in the Intent struct. Note that
    /// some fields are omitted here as they are not needed for one-to-one
    /// same-chain intents. Additionally, some fields have more strict types as
    /// they are not needed to be as flexible as in the Intent struct. All
    /// arrays are replaced with single elements, as one-to-one same-chain
    /// intents do not need multiple constraints.
    struct OneToOneSameChainIntent {
        uint32 intentChainId;
        address intentOwner;
        address receiver;
        InputToken inputToken;
        SingleSameChainTakeTokenConstraint takeToken;
        uint64 expirationTimestamp;
        uint64 intentTimestamp;
        address srcAllowedSender; // ANY_ADDRESS or specific address
        bytes executionMetadata;
        bytes combinedInteractions;
        address intentAuthority;
    }
}