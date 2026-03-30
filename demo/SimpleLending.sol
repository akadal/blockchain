// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SimpleLending {
    IERC20 public token;
    uint256 public collateralRatio = 150; // 150%

    mapping(address => uint256) public deposited;
    mapping(address => uint256) public borrowed;

    event Deposit(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor(address _token) {
        token = IERC20(_token);
    }

    function deposit(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        deposited[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    function borrow(uint256 amount) external {
        uint256 maxBorrow = (deposited[msg.sender] * 100) / collateralRatio;
        require(borrowed[msg.sender] + amount <= maxBorrow, "Insufficient collateral");
        borrowed[msg.sender] += amount;
        require(token.transfer(msg.sender, amount), "Transfer failed");
        emit Borrow(msg.sender, amount);
    }

    function repay(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        if (amount > borrowed[msg.sender]) amount = borrowed[msg.sender];
        borrowed[msg.sender] -= amount;
        emit Repay(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        uint256 minCollateral = (borrowed[msg.sender] * collateralRatio) / 100;
        require(deposited[msg.sender] >= amount, "Insufficient deposit");
        require(deposited[msg.sender] - amount >= minCollateral, "Collateral locked");
        deposited[msg.sender] -= amount;
        require(token.transfer(msg.sender, amount), "Transfer failed");
        emit Withdraw(msg.sender, amount);
    }
}
