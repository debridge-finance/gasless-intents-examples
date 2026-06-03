// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AllowlistGuard} from "../contracts/interactions/AllowlistGuard.sol";
import {IIntentSubmissionView} from "../contracts/interactions/interfaces/IIntentSubmissionView.sol";
import {IntentManagerCallable} from "../contracts/interactions/IntentManagerCallable.sol";
import {IPostInteractionHook} from "../contracts/interactions/interfaces/IPostInteractionHook.sol";
import {IPreSwapResult} from "../contracts/interactions/interfaces/IPreSwapResult.sol";

contract AllowlistGuardTest is Test {
    AllowlistGuard internal guard;

    address internal owner = address(this);

    uint256 internal aliceKey = uint256(0xA11CE);
    address internal alice;
    uint256 internal bobKey = uint256(0xB0B);
    address internal bob;

    address internal constant INTENT_MANAGER = 0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708;
    bytes32 internal constant INTENT_ID = bytes32(uint256(1));
    bytes32 internal constant OTHER_INTENT_ID = bytes32(uint256(3));
    bytes32 internal constant TRADE_ID = bytes32(uint256(2));

    function setUp() public {
        guard = new AllowlistGuard();
        alice = vm.addr(aliceKey);
        bob = vm.addr(bobKey);
    }

    function _sign(
        uint256 key,
        address subject,
        bytes32 intentId,
        bytes32 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                guard.ALLOWLIST_AUTHORIZATION_TYPEHASH(),
                subject,
                intentId,
                nonce,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", guard.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _payload(
        address subject,
        bytes32 intentId,
        bytes32 nonce,
        uint256 deadline,
        bytes memory signature
    ) internal pure returns (bytes memory) {
        return abi.encode(subject, intentId, nonce, deadline, signature);
    }

    function _mockSubmitted(address subject, bytes32 intentId, bool submitted) internal {
        vm.mockCall(
            INTENT_MANAGER,
            abi.encodeWithSelector(IIntentSubmissionView.isIntentSubmitted.selector, subject, intentId),
            abi.encode(submitted)
        );
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(guard.owner(), owner);
    }

    function test_DomainSeparator_Stable() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("AllowlistGuard")),
                keccak256(bytes("1")),
                block.chainid,
                address(guard)
            )
        );
        assertEq(guard.DOMAIN_SEPARATOR(), expected);
    }

    function test_OnPreCall_RevertsWhenNotAllowed_EvenWithValidSig() public {
        bytes32 nonce = bytes32(uint256(1));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, INTENT_ID, nonce, deadline);
        bytes memory payload = _payload(alice, INTENT_ID, nonce, deadline, sig);
        vm.expectRevert(abi.encodeWithSelector(AllowlistGuard.NotAllowed.selector, alice));
        vm.prank(INTENT_MANAGER);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
    }

    function test_OnPreCall_RevertsWhenNotIntentManager() public {
        bytes32 nonce = bytes32(uint256(1));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, INTENT_ID, nonce, deadline);
        bytes memory payload = _payload(alice, INTENT_ID, nonce, deadline, sig);
        vm.expectRevert(IntentManagerCallable.OnlyIntentManager.selector);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
        assertFalse(guard.usedNonces(alice, nonce));
    }

    function test_OnPreCall_RevertsOnImpersonation_BobSigningAsAlice() public {
        guard.setAllowed(alice, true);
        bytes32 nonce = bytes32(uint256(2));
        uint256 deadline = block.timestamp + 1 hours;
        // Bob signs over alice as subject → recovered signer == bob ≠ alice.
        bytes memory sig = _sign(bobKey, alice, INTENT_ID, nonce, deadline);
        bytes memory payload = _payload(alice, INTENT_ID, nonce, deadline, sig);
        vm.expectRevert(AllowlistGuard.InvalidSignature.selector);
        vm.prank(INTENT_MANAGER);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
    }

    function test_OnPreCall_AllowedAndValidSig_Succeeds() public {
        guard.setAllowed(alice, true);
        bytes32 nonce = bytes32(uint256(3));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, INTENT_ID, nonce, deadline);
        bytes memory payload = _payload(alice, INTENT_ID, nonce, deadline, sig);
        _mockSubmitted(alice, INTENT_ID, true);
        vm.prank(INTENT_MANAGER);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
        assertTrue(guard.usedNonces(alice, nonce));
    }

    function test_OnPreCall_RevertsWhenSignedIntentIdMismatchesCallback() public {
        guard.setAllowed(alice, true);
        bytes32 nonce = bytes32(uint256(33));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, OTHER_INTENT_ID, nonce, deadline);
        bytes memory payload = _payload(alice, OTHER_INTENT_ID, nonce, deadline, sig);
        vm.expectRevert(
            abi.encodeWithSelector(
                AllowlistGuard.IntentIdMismatch.selector,
                OTHER_INTENT_ID,
                INTENT_ID
            )
        );
        vm.prank(INTENT_MANAGER);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
        assertFalse(guard.usedNonces(alice, nonce));
    }

    function test_OnPreCall_RevertsWhenIntentNotSubmitted_DoesNotConsumeNonce() public {
        guard.setAllowed(alice, true);
        bytes32 nonce = bytes32(uint256(34));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, INTENT_ID, nonce, deadline);
        bytes memory payload = _payload(alice, INTENT_ID, nonce, deadline, sig);
        _mockSubmitted(alice, INTENT_ID, false);
        vm.expectRevert(
            abi.encodeWithSelector(AllowlistGuard.IntentNotSubmitted.selector, alice, INTENT_ID)
        );
        vm.prank(INTENT_MANAGER);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
        assertFalse(guard.usedNonces(alice, nonce));
    }

    function test_OnPreCall_NonceReuse_Reverts() public {
        guard.setAllowed(alice, true);
        bytes32 nonce = bytes32(uint256(4));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, INTENT_ID, nonce, deadline);
        bytes memory payload = _payload(alice, INTENT_ID, nonce, deadline, sig);
        _mockSubmitted(alice, INTENT_ID, true);
        vm.prank(INTENT_MANAGER);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
        vm.expectRevert(AllowlistGuard.NonceUsed.selector);
        vm.prank(INTENT_MANAGER);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
    }

    function test_OnPreCall_ExpiredDeadline_Reverts() public {
        guard.setAllowed(alice, true);
        bytes32 nonce = bytes32(uint256(5));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, INTENT_ID, nonce, deadline);
        bytes memory payload = _payload(alice, INTENT_ID, nonce, deadline, sig);
        vm.warp(deadline + 1);
        vm.expectRevert(AllowlistGuard.Expired.selector);
        vm.prank(INTENT_MANAGER);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
    }

    function test_OnPreCall_BadSigLength_Reverts() public {
        guard.setAllowed(alice, true);
        bytes32 nonce = bytes32(uint256(6));
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory badSig = new bytes(64);
        bytes memory payload = _payload(alice, INTENT_ID, nonce, deadline, badSig);
        vm.expectRevert(AllowlistGuard.InvalidSignatureLength.selector);
        vm.prank(INTENT_MANAGER);
        guard.onPreCall(INTENT_ID, TRADE_ID, payload);
    }

    function test_SetAllowed_OwnerOnly() public {
        vm.prank(alice);
        vm.expectRevert(AllowlistGuard.NotOwner.selector);
        guard.setAllowed(alice, true);
    }

    function test_SetManyAllowed_FlipsBatch() public {
        address[] memory batch = new address[](3);
        batch[0] = alice;
        batch[1] = bob;
        batch[2] = address(0xCAFE);
        guard.setManyAllowed(batch, true);
        for (uint256 i; i < batch.length; ++i) {
            assertTrue(guard.allowed(batch[i]));
        }
        guard.setManyAllowed(batch, false);
        for (uint256 i; i < batch.length; ++i) {
            assertFalse(guard.allowed(batch[i]));
        }
    }

    function test_TransferOwnership_ZeroReverts() public {
        vm.expectRevert(AllowlistGuard.ZeroAddress.selector);
        guard.transferOwnership(address(0));
    }

    function test_TransferOwnership_FlipsOwner() public {
        guard.transferOwnership(bob);
        assertEq(guard.owner(), bob);
        vm.expectRevert(AllowlistGuard.NotOwner.selector);
        guard.setAllowed(alice, true);
        vm.prank(bob);
        guard.setAllowed(alice, true);
        assertTrue(guard.allowed(alice));
    }

    function test_PostCalls_NoOpEvenWhenNotAllowed() public {
        IPostInteractionHook.SameChainWithPreSwapChainContext memory same = IPostInteractionHook
            .SameChainWithPreSwapChainContext({
                intentId: INTENT_ID,
                tradeId: TRADE_ID,
                payload: hex"",
                preSwapResults: new IPreSwapResult.PreSwapResult[](0),
                takeToken: address(0xDA1),
                takeAmountAfterFeeCharge: 1,
                receiver: alice
            });
        vm.prank(INTENT_MANAGER);
        guard.onPostCallForSameChainIntentWithPreSwap(same);

        IPostInteractionHook.CrossChainContext memory xc = IPostInteractionHook.CrossChainContext({
            intentId: INTENT_ID,
            tradeId: TRADE_ID,
            payload: hex"",
            giveToken: address(0xC0FFEE),
            giveAmount: 1,
            takeToken: abi.encodePacked(address(0xDA1)),
            takeAmount: 1,
            takeChainId: uint32(8453),
            takeChainReceiver: abi.encodePacked(alice)
        });
        vm.prank(INTENT_MANAGER);
        guard.onPostCallForCrossChainIntent(xc);
    }
}
