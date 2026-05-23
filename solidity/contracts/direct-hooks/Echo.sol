// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Echo {
    event Echoed(address indexed sender, string message);

    function echo(string calldata message) external {
        emit Echoed(msg.sender, message);
    }
}