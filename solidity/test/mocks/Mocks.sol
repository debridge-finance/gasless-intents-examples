// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IIntent} from "../../contracts/debridge/interfaces/IIntent.sol";

/// @notice Minimal ERC-20 for the example-contract tests (18 decimals, infinite-mint).
/// @dev Returns `bool` and uses standard semantics so OZ SafeERC20 accepts it.
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external
        returns (bool)
    {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "ERC20: allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "ERC20: balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
    }
}

/// @notice Minimal WETH9 (deposit/withdraw) on top of {MockERC20}.
contract MockWETH is MockERC20 {
    constructor() MockERC20("Wrapped Ether", "WETH") {}

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "WETH: balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "WETH: native send");
    }

    receive() external payable {
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
    }
}

/// @notice Mock deBridge IntentManager. Mirrors the exact selectors the
///         example contracts call and records enough to assert invariants.
/// @dev Etched at the hardcoded `INTENT_MANAGER` address in the test setUp.
///      `submitIntent` derives the id the same way the real contract does
///      (`keccak256(abi.encode(intent))`), so the caller's local id matches the
///      manager's `submittedIntents` key.
contract MockIntentManager {
    mapping(address => mapping(bytes32 => bool)) public submitted;
    mapping(address => mapping(bytes32 => bool)) public canceled;
    mapping(address => uint256) public nullificationTimestamp;

    address public lastSubmitter;
    uint256 public submitCount;
    uint256 public revokeCount;
    uint256 public cancelCount;

    IIntent.Intent internal _lastIntent;

    function submitIntent(IIntent.Intent calldata intent) external {
        bytes32 id = keccak256(abi.encode(intent));
        submitted[msg.sender][id] = true;
        lastSubmitter = msg.sender;
        _lastIntent = intent;
        ++submitCount;
    }

    function revokeSubmittedIntentById(bytes32 id) external {
        submitted[msg.sender][id] = false;
        ++revokeCount;
    }

    function setNullificationTimestamp(uint256 ts) external {
        nullificationTimestamp[msg.sender] = ts;
    }

    function cancelIntent(bytes32 id) external {
        canceled[msg.sender][id] = true;
        ++cancelCount;
    }

    function isIntentSubmitted(address owner, bytes32 id)
        external
        view
        returns (bool)
    {
        return submitted[owner][id];
    }

    // deBridge INTERNAL chain id. vm.etch copies code, not storage — tests
    // must call setChainId after etching.
    uint32 internal _chainId;

    function setChainId(uint32 chainId) external {
        _chainId = chainId;
    }

    function getChainId() external view returns (uint32) {
        return _chainId;
    }

    function getLastIntent()
        external
        view
        returns (IIntent.Intent memory)
    {
        return _lastIntent;
    }
}
