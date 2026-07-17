// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {IntentSubmitter} from "../contracts/submitter/IntentSubmitter.sol";
import {IIntent} from "../contracts/debridge/interfaces/IIntent.sol";
import {MockERC20, MockIntentManager} from "./mocks/Mocks.sol";

contract IntentSubmitterTest is Test {
    IntentSubmitter internal submitter;
    MockIntentManager internal mgr;
    MockERC20 internal usdc;

    // deBridge constants (must equal the values baked into the contract).
    address internal constant INTENT_MANAGER =
        0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708;
    address internal constant ALLOWANCE_HOLDER =
        0xddddddddd4B6472c5002F95610b194D1161223d0;
    address internal constant RECIPIENT =
        0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8;

    // deBridge INTERNAL chain ids.
    uint32 internal constant ARBITRUM = 42161;
    uint32 internal constant BASE = 8453;
    uint32 internal constant SOLANA = 7565164;
    uint32 internal constant TRON = 100000026;

    address internal owner = address(0xA11CE);
    address internal stranger = address(0xBAD);

    uint256 internal constant AMOUNT = 3_200_000; // 3.2 USDC (6 decimals)

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC");

        vm.prank(owner);
        submitter = new IntentSubmitter();

        // Etch the mock manager at the hardcoded INTENT_MANAGER address.
        MockIntentManager impl = new MockIntentManager();
        vm.etch(INTENT_MANAGER, address(impl).code);
        mgr = MockIntentManager(INTENT_MANAGER);
        mgr.setChainId(ARBITRUM); // etch copies code, not storage

        vm.warp(1_000_000);
    }

    /* ========== helpers ========== */

    /// @dev Mirrors the live-run struct shape from
    ///      onchain-submit-arb-usdc-to-base-usdc.ts (Arbitrum USDC -> Base USDC).
    function _validIntent() internal view returns (IIntent.Intent memory intent) {
        IIntent.AllowedAddress[] memory receivers = new IIntent.AllowedAddress[](1);
        uint32[] memory dstChains = new uint32[](1);
        dstChains[0] = BASE;
        receivers[0] = IIntent.AllowedAddress({
            allowedAddress: abi.encodePacked(RECIPIENT),
            chains: dstChains,
            isAnyChain: false
        });

        IIntent.InputToken[] memory inputs = new IIntent.InputToken[](1);
        inputs[0] = IIntent.InputToken({
            token: address(usdc),
            minPartialAmount: AMOUNT,
            maxPartialAmount: AMOUNT,
            budget: AMOUNT
        });

        IIntent.TakeTokenConstraint[] memory takes = new IIntent.TakeTokenConstraint[](1);
        takes[0] = IIntent.TakeTokenConstraint({
            giveToken: address(usdc),
            takeTokenChain: BASE,
            takeToken: abi.encodePacked(address(0xdA1)),
            numerator: 924859,
            denominator: 6
        });

        // dst cancel authority pinned to the owner (enforced by the contract).
        IIntent.AllowedAddress[] memory authorities = new IIntent.AllowedAddress[](1);
        authorities[0] = IIntent.AllowedAddress({
            allowedAddress: abi.encodePacked(owner),
            chains: dstChains,
            isAnyChain: false
        });

        intent = IIntent.Intent({
            intentChainId: ARBITRUM,
            intentOwner: address(submitter),
            receiverDetails: receivers,
            inputToken: inputs,
            giveToken: new IIntent.GiveTokenConstraint[](0),
            takeToken: takes,
            expirationTimestamp: uint64(block.timestamp + 1 days),
            intentTimestamp: uint64(block.timestamp),
            srcAllowedSender: new address[](0), // empty — not required for submission
            executionMetadata: new bytes(32), // fixed value: 32 zero bytes
            isAnyDlnMetadataAllowed: true,
            dlnMetadata: "",
            externalCallHash: bytes32(0),
            combinedInteractions: "",
            allowedCancelBeneficiary: RECIPIENT,
            dstAuthorityAddress: authorities,
            intentAuthority: RECIPIENT
        });
    }

    /* ========== happy path ========== */

    function test_SubmitIntent_ForwardsAndRegisters() public {
        IIntent.Intent memory intent = _validIntent();
        bytes32 expectedId = keccak256(abi.encode(intent));

        vm.prank(owner);
        bytes32 id = submitter.submitIntent(intent);

        assertEq(id, expectedId);

        // INVARIANT: the contract is BOTH intentOwner AND the submitter.
        assertEq(mgr.lastSubmitter(), address(submitter));
        assertTrue(mgr.isIntentSubmitted(address(submitter), id));
        assertTrue(submitter.isIntentSubmitted(id));

        // Struct forwarded verbatim (manager hashes to the same id).
        assertEq(keccak256(abi.encode(mgr.getLastIntent())), id);

        // Submission granted the AllowanceHolder a max approval.
        assertEq(
            usdc.allowance(address(submitter), ALLOWANCE_HOLDER),
            type(uint256).max
        );
    }

    function test_SubmitIntent_MaxApprovesOnlyWhenInsufficient() public {
        IIntent.Intent memory intent = _validIntent();
        vm.prank(owner);
        submitter.submitIntent(intent);
        assertEq(
            usdc.allowance(address(submitter), ALLOWANCE_HOLDER),
            type(uint256).max
        );

        // Allowance depleted below the budget -> next submit tops back to max.
        vm.prank(address(submitter));
        usdc.approve(ALLOWANCE_HOLDER, 1);
        intent.takeToken[0].numerator = 900000; // distinct intent
        vm.prank(owner);
        submitter.submitIntent(intent);
        assertEq(
            usdc.allowance(address(submitter), ALLOWANCE_HOLDER),
            type(uint256).max
        );

        // Allowance already covering the budget -> untouched (no re-approve).
        vm.prank(address(submitter));
        usdc.approve(ALLOWANCE_HOLDER, AMOUNT);
        intent.takeToken[0].numerator = 800000; // distinct intent
        vm.prank(owner);
        submitter.submitIntent(intent);
        assertEq(usdc.allowance(address(submitter), ALLOWANCE_HOLDER), AMOUNT);
    }

    function test_Rescue() public {
        usdc.mint(address(submitter), AMOUNT);
        vm.prank(owner);
        submitter.rescue(address(usdc), owner, AMOUNT);
        assertEq(usdc.balanceOf(owner), AMOUNT);
        assertEq(usdc.balanceOf(address(submitter)), 0);
    }

    function test_RevokeIntent() public {
        vm.prank(owner);
        bytes32 id = submitter.submitIntent(_validIntent());
        assertTrue(submitter.isIntentSubmitted(id));

        vm.prank(owner);
        submitter.revokeIntent(id);

        assertFalse(submitter.isIntentSubmitted(id));
        assertEq(mgr.revokeCount(), 1);
    }

    function test_RevokeIntentsUpTo_SetsNullificationTimestamp() public {
        vm.prank(owner);
        submitter.revokeIntentsUpTo(block.timestamp);
        assertEq(
            mgr.nullificationTimestamp(address(submitter)),
            block.timestamp
        );
    }

    /* ========== expiration enforcement ========== */

    function test_RejectsNonFutureExpiration() public {
        IIntent.Intent memory intent = _validIntent();
        intent.expirationTimestamp = uint64(block.timestamp);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IntentSubmitter.InvalidExpiration.selector,
                uint64(block.timestamp)
            )
        );
        submitter.submitIntent(intent);
    }

    function test_RejectsOverlongExpiration() public {
        IIntent.Intent memory intent = _validIntent();
        uint64 tooLate = uint64(block.timestamp + 30 days + 1);
        intent.expirationTimestamp = tooLate;

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.InvalidExpiration.selector, tooLate)
        );
        submitter.submitIntent(intent);

        // Boundary: exactly MAX_INTENT_TTL out is accepted.
        intent.expirationTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(owner);
        submitter.submitIntent(intent);
    }

    /* ========== recipient enforcement ========== */

    function test_RejectsWrongRecipient() public {
        IIntent.Intent memory intent = _validIntent();
        intent.receiverDetails[0].allowedAddress = abi.encodePacked(stranger);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IntentSubmitter.RecipientNotAllowed.selector,
                abi.encodePacked(stranger)
            )
        );
        submitter.submitIntent(intent);
    }

    function test_RejectsPadded32ByteRecipient() public {
        // Even the RIGHT address in the wrong (32-byte padded) encoding must fail:
        // the fill key compares packed 20-byte bytes.
        IIntent.Intent memory intent = _validIntent();
        intent.receiverDetails[0].allowedAddress = abi.encode(RECIPIENT);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IntentSubmitter.RecipientNotAllowed.selector,
                abi.encode(RECIPIENT)
            )
        );
        submitter.submitIntent(intent);
    }

    function test_RejectsEmptyReceiverList() public {
        IIntent.Intent memory intent = _validIntent();
        intent.receiverDetails = new IIntent.AllowedAddress[](0);

        vm.prank(owner);
        vm.expectRevert(IntentSubmitter.NoReceiver.selector);
        submitter.submitIntent(intent);
    }

    /* ========== chain enforcement (Solana / TRON banned) ========== */

    function test_RejectsSolanaIntentChainId() public {
        IIntent.Intent memory intent = _validIntent();
        intent.intentChainId = SOLANA;

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.ChainNotAllowed.selector, SOLANA)
        );
        submitter.submitIntent(intent);
    }

    function test_RejectsTronIntentChainId() public {
        IIntent.Intent memory intent = _validIntent();
        intent.intentChainId = TRON;

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.ChainNotAllowed.selector, TRON)
        );
        submitter.submitIntent(intent);
    }

    function test_RejectsSolanaTakeTokenChain() public {
        IIntent.Intent memory intent = _validIntent();
        intent.takeToken[0].takeTokenChain = SOLANA;

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.ChainNotAllowed.selector, SOLANA)
        );
        submitter.submitIntent(intent);
    }

    function test_RejectsTronReceiverChain() public {
        IIntent.Intent memory intent = _validIntent();
        intent.receiverDetails[0].chains[0] = TRON;

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.ChainNotAllowed.selector, TRON)
        );
        submitter.submitIntent(intent);
    }

    function test_RejectsAnyChainReceiver() public {
        // isAnyChain on the receiver would bypass the ban.
        IIntent.Intent memory intent = _validIntent();
        intent.receiverDetails[0].isAnyChain = true;
        vm.prank(owner);
        vm.expectRevert(IntentSubmitter.WildcardChainNotAllowed.selector);
        submitter.submitIntent(intent);
    }

    function test_RejectsZeroTakeTokenChain() public {
        IIntent.Intent memory intent = _validIntent();
        intent.takeToken[0].takeTokenChain = 0;
        vm.prank(owner);
        vm.expectRevert(IntentSubmitter.ZeroChainId.selector);
        submitter.submitIntent(intent);
    }

    function test_RejectsWrongIntentChain() public {
        // Allowed chain, but not the one the manager reports for this deployment.
        IIntent.Intent memory intent = _validIntent();
        intent.intentChainId = BASE;

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.WrongIntentChain.selector, BASE)
        );
        submitter.submitIntent(intent);
    }

    /* ========== dst cancel authority enforcement ========== */

    function test_RejectsEmptyDstAuthority() public {
        IIntent.Intent memory intent = _validIntent();
        intent.dstAuthorityAddress = new IIntent.AllowedAddress[](0);

        vm.prank(owner);
        vm.expectRevert(IntentSubmitter.NoDstAuthority.selector);
        submitter.submitIntent(intent);
    }

    function test_RejectsForeignDstAuthority() public {
        IIntent.Intent memory intent = _validIntent();
        intent.dstAuthorityAddress[0].allowedAddress = abi.encodePacked(stranger);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IntentSubmitter.DstAuthorityNotOwner.selector,
                abi.encodePacked(stranger)
            )
        );
        submitter.submitIntent(intent);
    }

    /* ========== structural / access control ========== */

    function test_RejectsForeignIntentOwner() public {
        IIntent.Intent memory intent = _validIntent();
        intent.intentOwner = owner; // must be the contract itself

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IntentSubmitter.IntentOwnerMustBeThisContract.selector,
                owner
            )
        );
        submitter.submitIntent(intent);
    }

    function test_OnlyOwner() public {
        IIntent.Intent memory intent = _validIntent();

        vm.startPrank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.NotOwner.selector, stranger)
        );
        submitter.submitIntent(intent);

        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.NotOwner.selector, stranger)
        );
        submitter.revokeIntent(bytes32(uint256(1)));

        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.NotOwner.selector, stranger)
        );
        submitter.revokeIntentsUpTo(block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(IntentSubmitter.NotOwner.selector, stranger)
        );
        submitter.rescue(address(usdc), stranger, AMOUNT);
        vm.stopPrank();
    }
}
