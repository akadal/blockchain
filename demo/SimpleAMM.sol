// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Simple ERC20 Token Interface
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

// Very simple automated market maker (AMM) for educational purposes
contract SimpleAMM {
    IERC20 public tokenA;
    IERC20 public tokenB;

    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    event Swap(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);
    event AddLiquidity(address indexed user, uint256 amountA, uint256 amountB, uint256 shares);
    event RemoveLiquidity(address indexed user, uint256 amountA, uint256 amountB, uint256 shares);

    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    // Simplistic liquidity provision
    function addLiquidity(uint256 _amountA, uint256 _amountB) external {
        require(tokenA.transferFrom(msg.sender, address(this), _amountA), "Transfer A failed");
        require(tokenB.transferFrom(msg.sender, address(this), _amountB), "Transfer B failed");

        uint256 sharesToMint;
        if (totalShares == 0) {
            sharesToMint = _amountA; // simplified initial shares
        } else {
            uint256 shareA = (_amountA * totalShares) / reserveA;
            uint256 shareB = (_amountB * totalShares) / reserveB;
            sharesToMint = shareA < shareB ? shareA : shareB; // min
        }

        require(sharesToMint > 0, "Shares = 0");
        shares[msg.sender] += sharesToMint;
        totalShares += sharesToMint;

        reserveA += _amountA;
        reserveB += _amountB;

        emit AddLiquidity(msg.sender, _amountA, _amountB, sharesToMint);
    }

    // Simplistic liquidity removal
    function removeLiquidity(uint256 _shares) external {
        require(shares[msg.sender] >= _shares, "Not enough shares");

        uint256 amountA = (_shares * reserveA) / totalShares;
        uint256 amountB = (_shares * reserveB) / totalShares;

        shares[msg.sender] -= _shares;
        totalShares -= _shares;
        reserveA -= amountA;
        reserveB -= amountB;

        require(tokenA.transfer(msg.sender, amountA), "Transfer A failed");
        require(tokenB.transfer(msg.sender, amountB), "Transfer B failed");

        emit RemoveLiquidity(msg.sender, amountA, amountB, _shares);
    }

    // Swap Token A for Token B using x*y=k formula (no fees for simplicity)
    function swapAToB(uint256 _amountAIn) external {
        require(_amountAIn > 0, "Amount must be > 0");
        require(reserveA > 0 && reserveB > 0, "No liquidity");

        uint256 amountBOut = getAmountOut(_amountAIn, reserveA, reserveB);

        require(tokenA.transferFrom(msg.sender, address(this), _amountAIn), "Transfer A failed");
        require(tokenB.transfer(msg.sender, amountBOut), "Transfer B failed");

        reserveA += _amountAIn;
        reserveB -= amountBOut;

        emit Swap(msg.sender, address(tokenA), _amountAIn, amountBOut);
    }

    // Swap Token B for Token A using x*y=k formula (no fees for simplicity)
    function swapBToA(uint256 _amountBIn) external {
        require(_amountBIn > 0, "Amount must be > 0");
        require(reserveA > 0 && reserveB > 0, "No liquidity");

        uint256 amountAOut = getAmountOut(_amountBIn, reserveB, reserveA);

        require(tokenB.transferFrom(msg.sender, address(this), _amountBIn), "Transfer B failed");
        require(tokenA.transfer(msg.sender, amountAOut), "Transfer A failed");

        reserveB += _amountBIn;
        reserveA -= amountAOut;

        emit Swap(msg.sender, address(tokenB), _amountBIn, amountAOut);
    }

    // Helper to calculate output amount (x*y=k formula: dy = y * dx / (x + dx))
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
        require(amountIn > 0 && reserveIn > 0 && reserveOut > 0, "Invalid reserves");
        // Simple formula without fees
        amountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
    }
}

// Simple ERC20 Token for testing AMM
contract TestToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    // Anyone can mint for testing
    function mint(uint256 amount) external {
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
        emit Transfer(address(0), msg.sender, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
