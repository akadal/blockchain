// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SimpleYieldFarm {
    IERC20 public lpToken;
    IERC20 public rewardToken;
    uint256 public rewardRate = 50; // APY 50% (Simplified)

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 lastUpdate;
    }

    mapping(address => UserInfo) public userInfo;
    uint256 public totalStaked;

    event Stake(address indexed user, uint256 amount);
    event Unstake(address indexed user, uint256 amount);
    event Harvest(address indexed user, uint256 amount);

    constructor(address _lpToken, address _rewardToken) {
        lpToken = IERC20(_lpToken);
        rewardToken = IERC20(_rewardToken);
    }

    function pendingReward(address user) public view returns (uint256) {
        UserInfo storage u = userInfo[user];
        if (u.amount == 0) return u.rewardDebt;
        uint256 elapsed = block.timestamp - u.lastUpdate;
        // Simplified reward calculation for demo
        uint256 reward = (u.amount * rewardRate * elapsed) / (365 days * 100);
        return u.rewardDebt + reward;
    }

    function stake(uint256 amount) external {
        updateReward(msg.sender);
        require(lpToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        userInfo[msg.sender].amount += amount;
        totalStaked += amount;
        emit Stake(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        updateReward(msg.sender);
        require(userInfo[msg.sender].amount >= amount, "Insufficient stake");
        userInfo[msg.sender].amount -= amount;
        totalStaked -= amount;
        require(lpToken.transfer(msg.sender, amount), "Transfer failed");
        emit Unstake(msg.sender, amount);
    }

    function harvest() external {
        updateReward(msg.sender);
        uint256 reward = userInfo[msg.sender].rewardDebt;
        if (reward > 0) {
            userInfo[msg.sender].rewardDebt = 0;
            // Note: The farm contract must have reward tokens to distribute
            require(rewardToken.transfer(msg.sender, reward), "Transfer failed");
            emit Harvest(msg.sender, reward);
        }
    }

    function updateReward(address user) internal {
        userInfo[user].rewardDebt = pendingReward(user);
        userInfo[user].lastUpdate = block.timestamp;
    }
}
